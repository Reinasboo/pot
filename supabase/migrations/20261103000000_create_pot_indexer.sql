create table public.pots (
    chain_id integer not null check (chain_id = 84532),
    address text not null check (address ~ '^0x[0-9a-f]{40}$'),
    organizer text not null check (organizer ~ '^0x[0-9a-f]{40}$'),
    target_based boolean not null,
    target_amount numeric(78, 0) not null check (target_amount >= 0),
    deadline bigint not null check (deadline >= 0),
    minimum_contribution numeric(78, 0) not null check (minimum_contribution > 0),
    name text not null check (char_length(name) between 1 and 80),
    metadata_uri text not null check (char_length(metadata_uri) <= 512),
    description text not null default '' check (char_length(description) <= 2000),
    cover_image_url text,
    is_public boolean not null default true,
    created_block bigint not null check (created_block >= 0),
    created_transaction_hash text not null check (created_transaction_hash ~ '^0x[0-9a-f]{64}$'),
    created_log_index integer not null check (created_log_index >= 0),
    created_at timestamptz not null default now(),
    primary key (chain_id, address),
    unique (chain_id, created_transaction_hash, created_log_index),
    check (
        (target_based and target_amount > 0 and deadline > 0 and minimum_contribution <= target_amount)
        or
        (not target_based and target_amount = 0 and deadline = 0)
    )
);

create index pots_public_created_idx
    on public.pots (created_at desc)
    where is_public;
create index pots_organizer_idx
    on public.pots (chain_id, organizer, created_block desc);

create table public.pot_events (
    chain_id integer not null,
    transaction_hash text not null check (transaction_hash ~ '^0x[0-9a-f]{64}$'),
    log_index integer not null check (log_index >= 0),
    pot_address text not null,
    block_number bigint not null check (block_number >= 0),
    block_hash text not null check (block_hash ~ '^0x[0-9a-f]{64}$'),
    event_name text not null check (
        event_name in (
            'PotCreated',
            'ContributionMade',
            'PotPaidOut',
            'ContributionRefunded'
        )
    ),
    event_data jsonb not null,
    indexed_at timestamptz not null default now(),
    primary key (chain_id, transaction_hash, log_index),
    foreign key (chain_id, pot_address)
        references public.pots (chain_id, address)
        on delete cascade
);

create index pot_events_history_idx
    on public.pot_events (chain_id, pot_address, block_number desc, log_index desc);

create table public.indexer_state (
    chain_id integer primary key check (chain_id = 84532),
    next_block bigint not null check (next_block >= 1),
    lease_id uuid,
    lease_until timestamptz,
    lease_to_block bigint,
    last_block_hash text check (
        last_block_hash is null or last_block_hash ~ '^0x[0-9a-f]{64}$'
    ),
    updated_at timestamptz not null default now(),
    check (
        (lease_id is null and lease_until is null and lease_to_block is null)
        or
        (lease_id is not null and lease_until is not null and lease_to_block is not null)
    )
);

alter table public.pots enable row level security;
alter table public.pot_events enable row level security;
alter table public.indexer_state enable row level security;

revoke all on public.pots from anon, authenticated;
revoke all on public.pot_events from anon, authenticated;
revoke all on public.indexer_state from anon, authenticated;

grant select on public.pots to anon, authenticated;
grant update (description, cover_image_url, is_public) on public.pots to authenticated;
grant select on public.pot_events to anon, authenticated;

create policy "Public pots are readable"
    on public.pots for select
    to anon, authenticated
    using (
        is_public
        or organizer = lower(
            coalesce(auth.jwt() -> 'app_metadata' ->> 'wallet_address', '')
        )
    );

create policy "Organizers may update pot display metadata"
    on public.pots for update
    to authenticated
    using (
        organizer = lower(
            coalesce(auth.jwt() -> 'app_metadata' ->> 'wallet_address', '')
        )
    )
    with check (
        organizer = lower(
            coalesce(auth.jwt() -> 'app_metadata' ->> 'wallet_address', '')
        )
    );

create policy "Public pot events follow pot visibility"
    on public.pot_events for select
    to anon, authenticated
    using (
        exists (
            select 1
            from public.pots
            where pots.chain_id = pot_events.chain_id
              and pots.address = pot_events.pot_address
              and (
                  pots.is_public
                  or pots.organizer = lower(
                      coalesce(auth.jwt() -> 'app_metadata' ->> 'wallet_address', '')
                  )
              )
        )
    );

create function public.claim_indexer_batch(
    p_chain_id integer,
    p_initial_block bigint,
    p_end_block bigint,
    p_batch_size integer,
    p_lease_id uuid
)
returns table (from_block bigint, to_block bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_next_block bigint;
    current_lease_until timestamptz;
    batch_start bigint;
    batch_end bigint;
begin
    if p_chain_id <> 84532
        or p_initial_block < 1
        or p_end_block < 0
        or p_batch_size < 1
        or p_batch_size > 2000
        or p_lease_id is null
    then
        raise exception 'invalid indexer batch parameters' using errcode = '22023';
    end if;

    insert into public.indexer_state (chain_id, next_block)
    values (p_chain_id, p_initial_block)
    on conflict (chain_id) do nothing;

    select state.next_block, state.lease_until
      into current_next_block, current_lease_until
      from public.indexer_state as state
     where state.chain_id = p_chain_id
     for update;

    if current_lease_until is not null and current_lease_until > now() then
        raise exception 'indexer batch is already leased' using errcode = '55P03';
    end if;

    if current_next_block > p_end_block then
        return query select null::bigint, null::bigint;
        return;
    end if;

    batch_start := current_next_block;
    batch_end := least(p_end_block, batch_start + p_batch_size - 1);

    update public.indexer_state as state
       set lease_id = p_lease_id,
           lease_until = now() + interval '10 minutes',
           lease_to_block = batch_end,
           updated_at = now()
     where state.chain_id = p_chain_id;

    return query select batch_start, batch_end;
end;
$$;

create function public.complete_indexer_batch(
    p_chain_id integer,
    p_lease_id uuid,
    p_to_block bigint,
    p_block_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_block_hash !~ '^0x[0-9a-f]{64}$' then
        raise exception 'invalid indexer block hash' using errcode = '22023';
    end if;

    update public.indexer_state as state
       set next_block = p_to_block + 1,
           lease_id = null,
           lease_until = null,
           lease_to_block = null,
           last_block_hash = p_block_hash,
           updated_at = now()
     where state.chain_id = p_chain_id
       and state.lease_id = p_lease_id
       and state.lease_to_block = p_to_block;

    if not found then
        raise exception 'indexer lease is missing or stale' using errcode = '40001';
    end if;
end;
$$;

create function public.release_indexer_batch(
    p_chain_id integer,
    p_lease_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
    update public.indexer_state as state
       set lease_id = null,
           lease_until = null,
           lease_to_block = null,
           updated_at = now()
     where state.chain_id = p_chain_id
       and state.lease_id = p_lease_id
$$;

create function public.rewind_indexer_cursor(
    p_chain_id integer,
    p_initial_block bigint,
    p_next_block bigint,
    p_last_block_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_next_block bigint;
    current_lease_until timestamptz;
begin
    if p_chain_id <> 84532
        or p_initial_block < 1
        or p_next_block < p_initial_block
        or p_last_block_hash !~ '^0x[0-9a-f]{64}$'
    then
        raise exception 'invalid indexer rewind parameters' using errcode = '22023';
    end if;

    select state.next_block, state.lease_until
      into current_next_block, current_lease_until
      from public.indexer_state as state
     where state.chain_id = p_chain_id
     for update;

    if not found or p_next_block >= current_next_block then
        raise exception 'indexer rewind must move the cursor backwards' using errcode = '22023';
    end if;

    if current_lease_until is not null and current_lease_until > now() then
        raise exception 'cannot rewind an active indexer batch' using errcode = '55P03';
    end if;

    delete from public.pot_events as event
     where event.chain_id = p_chain_id
       and event.block_number >= p_next_block;

    delete from public.pots as pot
     where pot.chain_id = p_chain_id
       and pot.created_block >= p_next_block;

    update public.indexer_state as state
       set next_block = p_next_block,
           lease_id = null,
           lease_until = null,
           lease_to_block = null,
           last_block_hash = p_last_block_hash,
           updated_at = now()
     where state.chain_id = p_chain_id;
end;
$$;

revoke all on function public.claim_indexer_batch(integer, bigint, bigint, integer, uuid)
    from public, anon, authenticated;
revoke all on function public.complete_indexer_batch(integer, uuid, bigint, text)
    from public, anon, authenticated;
revoke all on function public.release_indexer_batch(integer, uuid)
    from public, anon, authenticated;
revoke all on function public.rewind_indexer_cursor(integer, bigint, bigint, text)
    from public, anon, authenticated;

grant execute on function public.claim_indexer_batch(integer, bigint, bigint, integer, uuid)
    to service_role;
grant execute on function public.complete_indexer_batch(integer, uuid, bigint, text)
    to service_role;
grant execute on function public.release_indexer_batch(integer, uuid)
    to service_role;
grant execute on function public.rewind_indexer_cursor(integer, bigint, bigint, text)
    to service_role;

grant all on public.pots to service_role;
grant all on public.pot_events to service_role;
grant all on public.indexer_state to service_role;

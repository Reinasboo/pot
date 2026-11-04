create table public.app_action_nonces (
    nonce text primary key check (nonce ~ '^[0-9a-f]{32}$'),
    wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
    action_type text not null check (action_type in (
        'pot_update',
        'pot_reaction',
        'organizer_profile',
        'collection_create',
        'collection_delete',
        'collection_assign',
        'collection_unassign'
    )),
    action_target text not null check (char_length(action_target) between 1 and 128),
    action_payload text not null check (char_length(action_payload) between 1 and 8192),
    origin text not null check (char_length(origin) between 1 and 512),
    message text not null check (char_length(message) between 1 and 16384),
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    consumed_at timestamptz
);

create index app_action_nonces_wallet_created_idx
    on public.app_action_nonces (wallet_address, created_at desc);

create table public.pot_updates (
    id uuid primary key default gen_random_uuid(),
    chain_id integer not null check (chain_id = 84532),
    pot_address text not null,
    organizer text not null check (organizer ~ '^0x[0-9a-f]{40}$'),
    body text not null check (char_length(body) between 1 and 500),
    created_at timestamptz not null default now(),
    foreign key (chain_id, pot_address)
        references public.pots (chain_id, address)
        on delete cascade
);

create index pot_updates_public_history_idx
    on public.pot_updates (chain_id, pot_address, created_at desc);

create table public.pot_reactions (
    chain_id integer not null check (chain_id = 84532),
    pot_address text not null,
    wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
    reaction text not null check (reaction in ('heart', 'celebrate', 'support')),
    created_at timestamptz not null default now(),
    primary key (chain_id, pot_address, wallet_address),
    foreign key (chain_id, pot_address)
        references public.pots (chain_id, address)
        on delete cascade
);

create index pot_reactions_counts_idx
    on public.pot_reactions (chain_id, pot_address, reaction);

create table public.organizer_profiles (
    wallet_address text primary key check (wallet_address ~ '^0x[0-9a-f]{40}$'),
    display_name text not null default '' check (char_length(display_name) <= 60),
    bio text not null default '' check (char_length(bio) <= 280),
    accent_color text not null default '#087a3e'
        check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
    updated_at timestamptz not null default now()
);

create table public.creator_collections (
    id uuid primary key default gen_random_uuid(),
    organizer text not null check (organizer ~ '^0x[0-9a-f]{40}$'),
    name text not null check (char_length(name) between 1 and 60),
    description text not null default '' check (char_length(description) <= 280),
    created_at timestamptz not null default now(),
    unique (organizer, name)
);

create index creator_collections_organizer_idx
    on public.creator_collections (organizer, created_at desc);

create table public.creator_collection_pots (
    collection_id uuid not null references public.creator_collections (id) on delete cascade,
    chain_id integer not null,
    pot_address text not null,
    created_at timestamptz not null default now(),
    primary key (collection_id, chain_id, pot_address),
    foreign key (chain_id, pot_address)
        references public.pots (chain_id, address)
        on delete cascade
);

alter table public.app_action_nonces enable row level security;
alter table public.pot_updates enable row level security;
alter table public.pot_reactions enable row level security;
alter table public.organizer_profiles enable row level security;
alter table public.creator_collections enable row level security;
alter table public.creator_collection_pots enable row level security;

revoke all on public.app_action_nonces from public, anon, authenticated;
revoke all on public.pot_updates from public, anon, authenticated;
revoke all on public.pot_reactions from public, anon, authenticated;
revoke all on public.organizer_profiles from public, anon, authenticated;
revoke all on public.creator_collections from public, anon, authenticated;
revoke all on public.creator_collection_pots from public, anon, authenticated;
grant all on public.app_action_nonces to service_role;
grant all on public.pot_updates to service_role;
grant all on public.pot_reactions to service_role;
grant all on public.organizer_profiles to service_role;
grant all on public.creator_collections to service_role;
grant all on public.creator_collection_pots to service_role;

create function public.get_pot_reaction_summary(
    p_chain_id integer,
    p_pot_address text,
    p_wallet_address text default null
)
returns table (reaction text, reaction_count bigint, selected boolean)
language sql
stable
security definer
set search_path = ''
as $$
    select choices.reaction,
           count(reactions.wallet_address),
           coalesce(bool_or(reactions.wallet_address = p_wallet_address), false)
      from (values ('heart'), ('celebrate'), ('support')) as choices(reaction)
      left join public.pot_reactions as reactions
        on reactions.chain_id = p_chain_id
       and reactions.pot_address = p_pot_address
       and reactions.reaction = choices.reaction
      join public.pots as pots
        on pots.chain_id = p_chain_id
       and pots.address = p_pot_address
       and pots.is_public
     where p_chain_id = 84532
       and p_pot_address ~ '^0x[0-9a-f]{40}$'
       and (p_wallet_address is null or p_wallet_address ~ '^0x[0-9a-f]{40}$')
     group by choices.reaction
     order by choices.reaction;
$$;

revoke all on function public.get_pot_reaction_summary(integer, text, text)
    from public, anon, authenticated;
grant execute on function public.get_pot_reaction_summary(integer, text, text)
    to service_role;

create function public.issue_app_action_nonce(
    p_nonce text,
    p_wallet_address text,
    p_action_type text,
    p_action_target text,
    p_action_payload text,
    p_origin text,
    p_message text,
    p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    recent_count integer;
begin
    if p_nonce !~ '^[0-9a-f]{32}$'
        or p_wallet_address !~ '^0x[0-9a-f]{40}$'
        or p_action_type not in (
            'pot_update',
            'pot_reaction',
            'organizer_profile',
            'collection_create',
            'collection_delete',
            'collection_assign',
            'collection_unassign'
        )
        or char_length(p_action_target) not between 1 and 128
        or char_length(p_action_payload) not between 1 and 8192
        or char_length(p_origin) not between 1 and 512
        or char_length(p_message) not between 1 and 16384
        or p_expires_at <= now()
        or p_expires_at > now() + interval '5 minutes'
    then
        raise exception 'Invalid app action nonce request';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_wallet_address));
    delete from public.app_action_nonces
    where created_at <= now() - interval '10 minutes';

    select count(*)::integer
    into recent_count
    from public.app_action_nonces
    where wallet_address = p_wallet_address
      and created_at > now() - interval '10 minutes';

    if recent_count >= 10 then
        return false;
    end if;

    insert into public.app_action_nonces (
        nonce,
        wallet_address,
        action_type,
        action_target,
        action_payload,
        origin,
        message,
        expires_at
    )
    values (
        p_nonce,
        p_wallet_address,
        p_action_type,
        p_action_target,
        p_action_payload,
        p_origin,
        p_message,
        p_expires_at
    );

    return true;
end;
$$;

revoke all on function public.issue_app_action_nonce(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    timestamptz
) from public, anon, authenticated;
grant execute on function public.issue_app_action_nonce(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    timestamptz
) to service_role;

create table public.pot_metadata_nonces (
    nonce text primary key check (nonce ~ '^[0-9a-f]{32}$'),
    wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
    pot_address text not null check (pot_address ~ '^0x[0-9a-f]{40}$'),
    origin text not null check (char_length(origin) between 1 and 512),
    message text not null check (char_length(message) between 1 and 16384),
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    consumed_at timestamptz
);

create index pot_metadata_nonces_wallet_created_idx
    on public.pot_metadata_nonces (wallet_address, created_at desc);

alter table public.pot_metadata_nonces enable row level security;
revoke all on public.pot_metadata_nonces from public, anon, authenticated;
grant select, insert, update on public.pot_metadata_nonces to service_role;

create function public.issue_pot_metadata_nonce(
    p_nonce text,
    p_wallet_address text,
    p_pot_address text,
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
        or p_pot_address !~ '^0x[0-9a-f]{40}$'
        or char_length(p_origin) not between 1 and 512
        or char_length(p_message) not between 1 and 16384
        or p_expires_at <= now()
        or p_expires_at > now() + interval '5 minutes'
    then
        raise exception 'Invalid pot metadata nonce request';
    end if;

    perform pg_advisory_xact_lock(hashtext(p_wallet_address));
    delete from public.pot_metadata_nonces
    where created_at <= now() - interval '10 minutes';

    select count(*)::integer
    into recent_count
    from public.pot_metadata_nonces
    where wallet_address = p_wallet_address
      and created_at > now() - interval '10 minutes';

    if recent_count >= 5 then
        return false;
    end if;

    insert into public.pot_metadata_nonces (
        nonce,
        wallet_address,
        pot_address,
        origin,
        message,
        expires_at
    )
    values (
        p_nonce,
        p_wallet_address,
        p_pot_address,
        p_origin,
        p_message,
        p_expires_at
    );

    return true;
end;
$$;

revoke all on function public.issue_pot_metadata_nonce(
    text,
    text,
    text,
    text,
    text,
    timestamptz
) from public, anon, authenticated;
grant execute on function public.issue_pot_metadata_nonce(
    text,
    text,
    text,
    text,
    text,
    timestamptz
) to service_role;

alter table public.pots
    alter column is_public set default false;

create table public.private_pot_access (
    chain_id integer not null check (chain_id = 84532),
    pot_address text not null,
    access_key_hash text not null check (access_key_hash ~ '^[0-9a-f]{64}$'),
    updated_at timestamptz not null default now(),
    primary key (chain_id, pot_address),
    foreign key (chain_id, pot_address)
        references public.pots (chain_id, address)
        on delete cascade
);

alter table public.private_pot_access enable row level security;
revoke all on public.private_pot_access from public, anon, authenticated;
grant all on public.private_pot_access to service_role;

create function public.save_pot_visibility(
    p_chain_id integer,
    p_pot_address text,
    p_organizer text,
    p_description text,
    p_is_public boolean,
    p_access_key_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_chain_id <> 84532
        or p_pot_address !~ '^0x[0-9a-f]{40}$'
        or p_organizer !~ '^0x[0-9a-f]{40}$'
        or char_length(p_description) > 2000
        or (p_is_public and p_access_key_hash is not null)
        or (not p_is_public and (
            p_access_key_hash is null
            or p_access_key_hash !~ '^[0-9a-f]{64}$'
        ))
    then
        raise exception 'Invalid pot visibility settings';
    end if;

    update public.pots
       set description = p_description,
           is_public = p_is_public
     where chain_id = p_chain_id
       and address = p_pot_address
       and organizer = p_organizer;

    if not found then
        return false;
    end if;

    if p_is_public then
        delete from public.private_pot_access
         where chain_id = p_chain_id
           and pot_address = p_pot_address;
    else
        insert into public.private_pot_access (
            chain_id,
            pot_address,
            access_key_hash,
            updated_at
        )
        values (
            p_chain_id,
            p_pot_address,
            p_access_key_hash,
            now()
        )
        on conflict (chain_id, pot_address)
        do update set
            access_key_hash = excluded.access_key_hash,
            updated_at = excluded.updated_at;
    end if;

    return true;
end;
$$;

revoke all on function public.save_pot_visibility(integer, text, text, text, boolean, text)
    from public, anon, authenticated;
grant execute on function public.save_pot_visibility(integer, text, text, text, boolean, text)
    to service_role;

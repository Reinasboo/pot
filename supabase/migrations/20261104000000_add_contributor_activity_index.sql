create index pot_events_contributor_idx
    on public.pot_events (
        chain_id,
        (event_data ->> 'contributor'),
        block_number desc,
        log_index desc
    )
    where event_name = 'ContributionMade';

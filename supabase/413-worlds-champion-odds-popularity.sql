-- Migration 413: privacy-gated aggregate Pick 10 popularity for the public
-- Worlds champion outlook. Individual lineups remain private before lock.

begin;

create or replace function public.get_worlds_pick_popularity(
  p_event_id text default '2026-vgc-masters'
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with selected_event as (
    select event.id, event.locks_at
    from public.worlds_pick_events event
    where event.id = p_event_id
  ),
  event_entries as (
    select entry.pick_slugs, entry.ace_slug
    from public.worlds_pick_entries entry
    where entry.event_id = p_event_id
  ),
  sample_status as (
    select
      count(*)::integer as entry_count,
      count(*) >= 25 or now() >= (select locks_at from selected_event) as sample_ready
    from event_entries
  ),
  aggregate_popularity as (
    select
      selected.slug,
      count(*)::integer as pick_count,
      count(*) filter (where selected.slug = entry.ace_slug)::integer as ace_count
    from event_entries entry
    cross join lateral unnest(entry.pick_slugs) selected(slug)
    group by selected.slug
  )
  select case
    when not exists (select 1 from selected_event) then null
    else jsonb_build_object(
      'entry_count', (select entry_count from sample_status),
      'sample_ready', (select sample_ready from sample_status),
      'competitors', coalesce((
        select jsonb_agg(jsonb_build_object(
          'slug', competitor.slug,
          'pick_count', case when sample.sample_ready then coalesce(popularity.pick_count, 0) else 0 end,
          'ace_count', case when sample.sample_ready then coalesce(popularity.ace_count, 0) else 0 end
        ) order by competitor.source_order)
        from public.worlds_pick_competitors competitor
        cross join sample_status sample
        left join aggregate_popularity popularity on popularity.slug = competitor.slug
        where competitor.event_id = p_event_id
      ), '[]'::jsonb)
    )
  end;
$$;

comment on function public.get_worlds_pick_popularity(text) is
  'Returns aggregate pick and ace counts only after 25 entries or the event lock; never returns user identities or individual lineups.';

revoke all on function public.get_worlds_pick_popularity(text) from public, anon, authenticated, service_role;
grant execute on function public.get_worlds_pick_popularity(text) to anon, authenticated;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.worlds_pick_events'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.worlds_pick_competitors'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.worlds_pick_entries'::regclass) then
    raise exception 'Worlds Pick 10 tables must retain RLS';
  end if;
  if has_table_privilege('anon', 'public.worlds_pick_entries', 'SELECT')
     or has_table_privilege('authenticated', 'public.worlds_pick_entries', 'SELECT')
     or not has_function_privilege('anon', 'public.get_worlds_pick_popularity(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_worlds_pick_popularity(text)', 'EXECUTE') then
    raise exception 'Worlds popularity grants changed unexpectedly';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;

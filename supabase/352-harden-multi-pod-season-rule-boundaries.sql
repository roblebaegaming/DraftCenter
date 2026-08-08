-- Harden the browser-facing season rule boundary and keep the organization
-- audit sequence private in every environment, regardless of default grants.
begin;

revoke all on sequence public.league_organization_audit_events_id_seq
  from public, anon, authenticated;
grant usage, select on sequence public.league_organization_audit_events_id_seq
  to service_role;

create or replace function public.create_league_organization_season(
  p_organization_id uuid,
  p_name text,
  p_regulations jsonb default '{}'::jsonb,
  p_top_per_pod integer default 2,
  p_wildcard_slots integer default 0,
  p_tiebreakers text[] default array['wins', 'differential', 'head-to-head']
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not public.is_league_organization_admin(p_organization_id) then
    raise exception 'Only organization administrators can create seasons.';
  end if;
  if char_length(v_name) not between 2 and 120
     or p_regulations is null
     or jsonb_typeof(p_regulations) <> 'object'
     or p_top_per_pod is null
     or p_top_per_pod not between 1 and 16
     or p_wildcard_slots is null
     or p_wildcard_slots not between 0 and 32
     or array_ndims(p_tiebreakers) is distinct from 1
     or cardinality(p_tiebreakers) not between 1 and 5
     or exists (
       select 1
       from unnest(p_tiebreakers) value
       where value is null
          or value not in ('wins', 'differential', 'head-to-head', 'game-win-percentage', 'commissioner-draw')
     )
     or cardinality(p_tiebreakers) <> (
       select count(distinct value)::integer
       from unnest(p_tiebreakers) value
     ) then
    raise exception 'Season settings are invalid.';
  end if;

  insert into public.league_organization_seasons(
    organization_id,
    name,
    regulations,
    qualification_rules
  ) values (
    p_organization_id,
    v_name,
    p_regulations,
    jsonb_build_object(
      'top_per_pod', p_top_per_pod,
      'wildcard_slots', p_wildcard_slots,
      'tiebreakers', to_jsonb(p_tiebreakers)
    )
  ) returning id into v_id;

  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = p_organization_id;
  insert into public.league_organization_audit_events(
    organization_id, season_id, actor_id, kind, payload
  ) values (
    p_organization_id, v_id, auth.uid(), 'season_created',
    jsonb_build_object('top_per_pod', p_top_per_pod, 'wildcard_slots', p_wildcard_slots)
  );
  return v_id;
end;
$$;

revoke all on function public.create_league_organization_season(
  uuid, text, jsonb, integer, integer, text[]
) from public, anon, authenticated;
grant execute on function public.create_league_organization_season(
  uuid, text, jsonb, integer, integer, text[]
) to authenticated;

notify pgrst, 'reload schema';

commit;

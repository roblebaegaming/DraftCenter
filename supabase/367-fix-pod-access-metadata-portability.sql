-- Keep linked-pod access compatible with retained Preview branches that do not
-- carry every optional league metadata column from the production baseline.
-- Migration 366 already ran in Preview, so this correction is forward-only.

begin;

create or replace function public.get_my_league_access(p_league_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_league public.leagues%rowtype;
  v_role public.membership_role;
  v_access_role text;
begin
  if auth.uid() is null then return null; end if;

  select league.*
    into v_league
  from public.leagues league
  where league.slug = btrim(coalesce(p_league_key, ''))
     or league.id::text = btrim(coalesce(p_league_key, ''))
  order by case when league.slug = btrim(coalesce(p_league_key, '')) then 0 else 1 end
  limit 1;
  if not found then return null; end if;

  select membership.role
    into v_role
  from public.league_memberships membership
  where membership.league_id = v_league.id
    and membership.user_id = auth.uid();

  if v_role::text in ('commissioner', 'co_commissioner', 'coach') then
    v_access_role := v_role::text;
  elsif public.is_linked_pod_manager(v_league.id) then
    v_access_role := 'pod_manager';
  elsif v_role::text = 'viewer' then
    v_access_role := 'viewer';
  else
    return null;
  end if;

  return jsonb_build_object(
    'role', v_access_role,
    'league', jsonb_build_object(
      'id', v_league.id,
      'name', v_league.name,
      'slug', v_league.slug,
      'description', v_league.description,
      'image_url', v_league.image_url,
      'season_label', v_league.season_label,
      'status', v_league.status,
      'draft_starts_at', v_league.draft_starts_at,
      'league_visibility', v_league.league_visibility,
      'draft_start_visibility', to_jsonb(v_league) -> 'draft_start_visibility',
      'is_practice', v_league.is_practice,
      'practice_expires_at', v_league.practice_expires_at,
      'lifecycle_archived_at', to_jsonb(v_league) -> 'lifecycle_archived_at',
      'workspace_kind', to_jsonb(v_league) -> 'workspace_kind'
    )
  );
end;
$$;

revoke all on function public.get_my_league_access(text) from public, anon, authenticated;
grant execute on function public.get_my_league_access(text) to authenticated;

notify pgrst, 'reload schema';

commit;

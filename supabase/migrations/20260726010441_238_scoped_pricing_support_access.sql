-- Commissioner-approved, time-limited support editing for Pokémon tiers/pricing.
-- The support account remains outside league membership and can only change
-- pricing fields through the guarded server route.

begin;

alter table public.league_support_grants
  drop constraint if exists league_support_grants_permission_check;
alter table public.league_support_grants
  add constraint league_support_grants_permission_check
  check (permission in ('read_only', 'pricing_edit'));

alter table public.league_support_audit_log
  drop constraint if exists league_support_audit_log_action_check;
alter table public.league_support_audit_log
  add constraint league_support_audit_log_action_check
  check (action in ('approved', 'viewed', 'revoked', 'expired', 'pricing_updated'));

alter table public.league_recovery_snapshots
  drop constraint if exists league_recovery_snapshots_source_check;
alter table public.league_recovery_snapshots
  add constraint league_recovery_snapshots_source_check
  check (source in ('automatic', 'pre_restore', 'pre_support_edit'));

create or replace function public.apply_scoped_support_pricing_update(
  p_league_id uuid,
  p_grant_id uuid,
  p_actor_user_id uuid,
  p_expected_revision bigint,
  p_confirmation text,
  p_changes jsonb,
  p_price_tier_max integer,
  p_source_file text default 'support pricing upload'
)
returns table(new_revision bigint, recovery_snapshot_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_name text;
  v_state jsonb;
  v_revision bigint;
  v_overrides jsonb;
  v_audit_changes jsonb := '[]'::jsonb;
  v_seen text[] := array[]::text[];
  v_item jsonb;
  v_name text;
  v_key text;
  v_price integer;
  v_recovery_id uuid;
begin
  if not exists (
    select 1 from public.league_support_grants grant_row
    where grant_row.id = p_grant_id
      and grant_row.league_id = p_league_id
      and grant_row.support_user_id = p_actor_user_id
      and grant_row.permission = 'pricing_edit'
      and grant_row.revoked_at is null
      and grant_row.expires_at > now()
  ) then
    raise exception 'An active commissioner-approved tier and pricing grant is required.';
  end if;

  select league.name into v_league_name
  from public.leagues league
  where league.id = p_league_id;
  if v_league_name is null or btrim(coalesce(p_confirmation, '')) <> v_league_name then
    raise exception 'Type the exact league name to confirm these pricing changes.';
  end if;

  select snapshot.state, snapshot.revision into v_state, v_revision
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id
  for update;
  if v_revision is null then raise exception 'The league snapshot is unavailable.'; end if;
  if v_revision <> p_expected_revision then
    raise exception 'The league changed while you were reviewing it. Reload and review the file again.';
  end if;

  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) < 1 or jsonb_array_length(p_changes) > 1000 then
    raise exception 'Upload between 1 and 1,000 pricing changes.';
  end if;
  if p_price_tier_max is null or p_price_tier_max < 2 or p_price_tier_max > 100 then
    raise exception 'The top price tier must be a whole number from 2 to 100.';
  end if;

  if jsonb_typeof(v_state) <> 'object' then v_state := '{}'::jsonb; end if;
  if jsonb_typeof(v_state->'settings') <> 'object' then
    v_state := jsonb_set(v_state, '{settings}', '{}'::jsonb, true);
  end if;
  v_overrides := case when jsonb_typeof(v_state#>'{settings,costOverrides}') = 'object' then v_state#>'{settings,costOverrides}' else '{}'::jsonb end;

  for v_item in select value from jsonb_array_elements(p_changes)
  loop
    v_name := btrim(coalesce(v_item->>'name', ''));
    v_key := lower(v_name);
    begin v_price := (v_item->>'price')::integer;
    exception when others then raise exception '% needs a whole-number price from 1 to 100.', coalesce(nullif(v_name, ''), 'Each Pokémon'); end;
    if v_name = '' or length(v_name) > 100 or v_key = any(array['__proto__','prototype','constructor']) then
      raise exception 'A pricing row has an invalid Pokémon name.';
    end if;
    if v_key = any(v_seen) then raise exception '% appears more than once in the pricing changes.', v_name; end if;
    if v_price < 1 or v_price > 100 then raise exception '% needs a whole-number price from 1 to 100.', v_name; end if;
    if v_price > p_price_tier_max then raise exception 'The top price tier must be at least as high as every imported price.'; end if;
    v_seen := array_append(v_seen, v_key);
    v_audit_changes := v_audit_changes || jsonb_build_array(jsonb_build_object('name', v_name, 'before', v_overrides->v_name, 'after', v_price));
    v_overrides := v_overrides || jsonb_build_object(v_name, v_price);
  end loop;

  insert into public.league_recovery_snapshots(league_id, revision, state, source)
  values(p_league_id, v_revision, v_state, 'pre_support_edit')
  returning id into v_recovery_id;

  v_state := jsonb_set(v_state, '{settings,costOverrides}', v_overrides, true);
  v_state := jsonb_set(v_state, '{settings,priceTierMax}', to_jsonb(p_price_tier_max), true);
  update public.league_state_snapshots
  set state = v_state, revision = v_revision + 1, updated_at = now()
  where league_id = p_league_id and revision = v_revision;
  if not found then raise exception 'The league changed before the pricing update could be saved.'; end if;

  insert into public.league_support_audit_log(league_id, grant_id, actor_user_id, action, details)
  values(p_league_id, p_grant_id, p_actor_user_id, 'pricing_updated', jsonb_build_object(
    'change_count', jsonb_array_length(v_audit_changes),
    'changes', v_audit_changes,
    'source_file', left(coalesce(p_source_file, 'support pricing upload'), 180),
    'from_revision', v_revision,
    'to_revision', v_revision + 1,
    'recovery_snapshot_id', v_recovery_id
  ));

  return query select v_revision + 1, v_recovery_id;
end;
$$;

revoke all on function public.apply_scoped_support_pricing_update(uuid,uuid,uuid,bigint,text,jsonb,integer,text) from public, anon, authenticated;
grant execute on function public.apply_scoped_support_pricing_update(uuid,uuid,uuid,bigint,text,jsonb,integer,text) to service_role;

commit;

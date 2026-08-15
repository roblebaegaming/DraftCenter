-- Preview-only regression for migration 405. It temporarily adds the optional
-- current-production My Teams columns when the retained Preview baseline omits
-- them, exercises insert and update recovery, and rolls back every change.

begin;

alter table public.personal_teams
  add column if not exists team_report_url text,
  add column if not exists is_public boolean not null default false,
  add column if not exists regulation_id text,
  add column if not exists public_summary text not null default '',
  add column if not exists share_pokepaste boolean not null default false,
  add column if not exists share_replica_code boolean not null default false,
  add column if not exists share_team_report boolean not null default false,
  add column if not exists nuzlocke_run jsonb;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_restored integer;
  v_backup jsonb;
begin
  insert into auth.users(id, aud, role)
  values (v_owner, 'authenticated', 'authenticated');

  v_backup := jsonb_build_array(jsonb_build_object(
    'id', v_team,
    'team_name', 'Recovery compatibility team',
    'league_name', 'Private rehearsal',
    'format_name', 'National Dex',
    'workspace_type', 'weekly',
    'planning_entries', '[]'::jsonb,
    'notes', 'Private notes',
    'weekly_notes', 'Week notes',
    'pokepaste_url', 'https://pokepast.es/example',
    'replica_code', 'PRIVATE-CODE',
    'spreadsheet_url', 'https://example.com/private-sheet',
    'team_report_url', 'https://example.com/private-report',
    'pokemon', '["Garchomp"]'::jsonb,
    'team_sets', '{"version":1,"pokemon":[{"name":"Garchomp","nickname":"Chomp","gender":"M","level":50,"ability":"Rough Skin","item":"Choice Scarf","nature":"Jolly","tera_type":"Fire","shiny":false,"happiness":255,"evs":{"hp":4,"atk":252,"def":0,"spa":0,"spd":0,"spe":252},"ivs":{"hp":31,"atk":31,"def":31,"spa":31,"spd":31,"spe":31},"moves":["Earthquake","Dragon Claw","Protect"],"role":"Cleaner","notes":"Private benchmark"}]}'::jsonb,
    'archived', false,
    'is_public', true,
    'regulation_id', 'national-dex',
    'public_summary', 'Public summary',
    'share_pokepaste', true,
    'share_replica_code', true,
    'share_team_report', true,
    'nuzlocke_run', null
  ));

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  select public.restore_my_personal_teams(v_backup) into v_restored;
  if v_restored <> 1
     or (select team_sets -> 'pokemon' -> 0 ->> 'ability' from public.personal_teams where id = v_team) <> 'Rough Skin'
     or (select team_report_url from public.personal_teams where id = v_team) <> 'https://example.com/private-report'
     or not (select share_team_report from public.personal_teams where id = v_team)
     or (select public_summary from public.personal_teams where id = v_team) <> 'Public summary' then
    raise exception 'Migration 405 insert recovery omitted a supported private or sharing field.';
  end if;

  update public.personal_teams
  set team_sets = '{"version":1,"pokemon":[]}'::jsonb,
      team_report_url = null,
      share_team_report = false,
      public_summary = ''
  where id = v_team;

  select public.restore_my_personal_teams(v_backup) into v_restored;
  if v_restored <> 1
     or (select team_sets -> 'pokemon' -> 0 ->> 'item' from public.personal_teams where id = v_team) <> 'Choice Scarf'
     or (select team_report_url from public.personal_teams where id = v_team) <> 'https://example.com/private-report'
     or not (select share_team_report from public.personal_teams where id = v_team)
     or (select public_summary from public.personal_teams where id = v_team) <> 'Public summary' then
    raise exception 'Migration 405 update recovery omitted a supported private or sharing field.';
  end if;

  if has_function_privilege('anon', 'public.restore_my_personal_teams(jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.restore_my_personal_teams(jsonb)', 'execute') then
    raise exception 'Migration 405 recovery grants are incorrect.';
  end if;
end;
$validation$;

rollback;

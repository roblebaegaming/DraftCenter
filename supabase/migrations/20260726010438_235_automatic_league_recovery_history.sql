-- Automatic, private recovery points for changing league state.
begin;
create table if not exists public.league_recovery_snapshots (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  revision bigint not null,
  state jsonb not null,
  source text not null default 'automatic' check (source in ('automatic','pre_restore')),
  created_at timestamptz not null default now()
);
create index if not exists league_recovery_snapshots_lookup_idx on public.league_recovery_snapshots(league_id,created_at desc);
alter table public.league_recovery_snapshots enable row level security;
revoke all on public.league_recovery_snapshots from public,anon,authenticated;

insert into public.league_recovery_snapshots(league_id,revision,state,source)
select snapshot.league_id,snapshot.revision,snapshot.state,'automatic'
from public.league_state_snapshots snapshot
where not exists (select 1 from public.league_recovery_snapshots recovery where recovery.league_id=snapshot.league_id);

create or replace function public.capture_league_recovery_snapshot()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.state is distinct from new.state and not exists (
    select 1 from public.league_recovery_snapshots r
    where r.league_id=old.league_id and r.created_at > now()-interval '6 hours'
  ) then
    insert into public.league_recovery_snapshots(league_id,revision,state,source)
    values(old.league_id,old.revision,old.state,'automatic');
    delete from public.league_recovery_snapshots
    where league_id=old.league_id and created_at < now()-interval '30 days';
  end if;
  return new;
end; $$;

drop trigger if exists capture_league_recovery_snapshot_trigger on public.league_state_snapshots;
create trigger capture_league_recovery_snapshot_trigger before update of state on public.league_state_snapshots
for each row execute function public.capture_league_recovery_snapshot();
commit;

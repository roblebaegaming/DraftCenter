-- Account-wide achievements, Daily Three streaks, legacy league badge import,
-- and profile award notifications. Run after migration 056.

begin;

create table if not exists public.badge_catalog (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null,
  category text not null,
  thresholds integer[] not null,
  tier_names text[] not null default array['Bronze','Silver','Gold'],
  created_at timestamptz not null default now()
);

create table if not exists public.user_badge_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_code text not null references public.badge_catalog(code) on delete cascade,
  subject text not null default '',
  progress integer not null default 0,
  tier integer not null default 0,
  first_earned_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(user_id, badge_code, subject)
);

create table if not exists public.badge_award_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_code text not null references public.badge_catalog(code),
  subject text not null default '',
  tier integer not null,
  awarded_at timestamptz not null default now(),
  seen_at timestamptz,
  unique(user_id, badge_code, subject, tier)
);

create table if not exists public.daily_three_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  completed_at timestamptz not null default now(),
  primary key(user_id, activity_date)
);

alter table public.badge_catalog enable row level security;
alter table public.user_badge_progress enable row level security;
alter table public.badge_award_events enable row level security;
alter table public.daily_three_completions enable row level security;

insert into public.badge_catalog(code,name,description,icon,category,thresholds) values
('daily_trio','Daily Three','Complete the Poll, Draft Bracket, and Pokémon Quiz on the same local day.','🎉','community',array[1,7,30]),
('daily_streak','Daily Three Streak','Complete the Daily Three on consecutive days.','🔥','community',array[3,7,30]),
('community_regular','Community Regular','Complete the Daily Three on many total days.','📅','community',array[10,25,100]),
('career_wins','Career Winner','Win matches across all DraftCenter leagues.','🏅','competition',array[1,10,100]),
('pokemon_loyalist','Pokémon Loyalist','Draft the same Pokémon across your DraftCenter career.','💛','drafting',array[1,5,10]),
('generation_veteran','Generation Veteran','Draft Pokémon from the same generation across your career.','🧭','drafting',array[10,25,50]),
('league_champion','League Champion','Win league championships across DraftCenter.','🏆','competition',array[1,5,10]),
('playoff_qualifier','Playoff Regular','Qualify for playoffs across DraftCenter leagues.','⭐','competition',array[1,5,10]),
('prediction_champion','Prediction Champion','Finish a season atop a prediction leaderboard.','🔮','community',array[1,5,10]),
('draft_day_hero','Draft Day Hero','Receive the most Draft Day Hero votes.','🎯','drafting',array[1,5,10]),
('trade_master','Trade Master','Finish a season as one of its most active traders.','🔄','management',array[1,5,10]),
('waiver_wizard','Waiver Wire Wizard','Lead a season in successful free-agent moves.','🧙','management',array[1,5,10]),
('perfect_season','Perfect Season','Complete an undefeated regular season.','💯','competition',array[1,3,5]),
('giant_slayer','Giant Slayer','Earn a season Giant Slayer award.','⚔️','competition',array[1,5,10])
on conflict(code) do update set name=excluded.name,description=excluded.description,icon=excluded.icon,category=excluded.category,thresholds=excluded.thresholds;

create or replace function public.set_badge_progress(p_user uuid,p_code text,p_subject text,p_progress integer)
returns void language plpgsql security definer set search_path=public as $$
declare v_old integer:=0; v_new integer:=0; v_thresholds integer[]; v_value integer:=greatest(0,coalesce(p_progress,0)); v_threshold integer;
begin
  select thresholds into v_thresholds from public.badge_catalog where code=p_code;
  if v_thresholds is null then return; end if;
  select tier into v_old from public.user_badge_progress where user_id=p_user and badge_code=p_code and subject=coalesce(p_subject,'');
  foreach v_threshold in array v_thresholds loop if v_value>=v_threshold then v_new:=v_threshold; end if; end loop;
  insert into public.user_badge_progress(user_id,badge_code,subject,progress,tier,first_earned_at)
  values(p_user,p_code,coalesce(p_subject,''),v_value,v_new,case when v_new>0 then now() end)
  on conflict(user_id,badge_code,subject) do update set progress=excluded.progress,tier=greatest(public.user_badge_progress.tier,excluded.tier),
    first_earned_at=coalesce(public.user_badge_progress.first_earned_at,excluded.first_earned_at),updated_at=now();
  if v_new>v_old then
    foreach v_threshold in array v_thresholds loop
      if v_threshold>v_old and v_threshold<=v_new then
        insert into public.badge_award_events(user_id,badge_code,subject,tier) values(p_user,p_code,coalesce(p_subject,''),v_threshold) on conflict do nothing;
      end if;
    end loop;
  end if;
end; $$;

create or replace function public.refresh_daily_three(p_user uuid,p_date date)
returns void language plpgsql security definer set search_path=public as $$
declare v_poll boolean; v_bracket boolean; v_quiz boolean; v_total integer; v_current integer:=0; v_best integer:=0; v_run integer:=0; v_prev date; r record;
begin
  select exists(select 1 from public.daily_poll_answers a join public.daily_polls p on p.id=a.poll_id where a.user_id=p_user and p.poll_date=p_date) into v_poll;
  select exists(select 1 from public.daily_bracket_matchups m join public.daily_draft_brackets b on b.id=m.bracket_id where m.user_id=p_user and b.game_date=p_date and m.round_number=3) into v_bracket;
  select exists(select 1 from public.daily_quiz_answers a join public.daily_quizzes q on q.id=a.quiz_id where a.user_id=p_user and q.quiz_date=p_date) into v_quiz;
  if v_poll and v_bracket and v_quiz then insert into public.daily_three_completions(user_id,activity_date) values(p_user,p_date) on conflict do nothing; end if;
  select count(*)::integer into v_total from public.daily_three_completions where user_id=p_user;
  for r in select activity_date from public.daily_three_completions where user_id=p_user order by activity_date loop
    if v_prev is not null and r.activity_date=v_prev+1 then v_run:=v_run+1; else v_run:=1; end if;
    v_best:=greatest(v_best,v_run); v_prev:=r.activity_date;
  end loop;
  v_prev:=p_date; v_current:=0;
  while exists(select 1 from public.daily_three_completions where user_id=p_user and activity_date=v_prev) loop v_current:=v_current+1; v_prev:=v_prev-1; end loop;
  perform public.set_badge_progress(p_user,'daily_trio','',v_total);
  perform public.set_badge_progress(p_user,'community_regular','',v_total);
  perform public.set_badge_progress(p_user,'daily_streak','',greatest(v_current,v_best));
end; $$;

create or replace function public.daily_three_activity_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_date date;
begin
  if tg_table_name='daily_poll_answers' then select poll_date into v_date from public.daily_polls where id=new.poll_id;
  elsif tg_table_name='daily_quiz_answers' then select quiz_date into v_date from public.daily_quizzes where id=new.quiz_id;
  else select game_date into v_date from public.daily_draft_brackets where id=new.bracket_id; if new.round_number<>3 then return new; end if;
  end if;
  perform public.refresh_daily_three(new.user_id,v_date); return new;
end; $$;

drop trigger if exists daily_three_poll on public.daily_poll_answers;
create trigger daily_three_poll after insert or update on public.daily_poll_answers for each row execute function public.daily_three_activity_trigger();
drop trigger if exists daily_three_quiz on public.daily_quiz_answers;
create trigger daily_three_quiz after insert on public.daily_quiz_answers for each row execute function public.daily_three_activity_trigger();
drop trigger if exists daily_three_bracket on public.daily_bracket_matchups;
create trigger daily_three_bracket after insert on public.daily_bracket_matchups for each row execute function public.daily_three_activity_trigger();

create or replace function public.get_my_badge_profile()
returns jsonb language sql stable security definer set search_path=public as $$
select '{}'::jsonb; $$;

create or replace function public.refresh_my_account_badges()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_name text; v_state jsonb; v_badges jsonb; v_map jsonb:=jsonb_build_object(
'draftDayHero','draft_day_hero','leagueChampion','league_champion','playoffQualifier','playoff_qualifier','predictionChampion','prediction_champion',
'biggestTrader','trade_master','waiverWireWizard','waiver_wizard','perfectSeason','perfect_season','giantSlayer','giant_slayer');
v_key text; v_code text; v_total integer; r record;
begin
  if auth.uid() is null then raise exception 'Sign in to view badges.'; end if;
  select coalesce(nullif(display_name,''),username) into v_name from public.profiles where id=auth.uid();
  for v_key,v_code in select key,value#>>'{}' from jsonb_each(v_map) loop
    select coalesce(sum(coalesce((s.state#>array['badges',v_name,v_key])::text::integer,0)),0)::integer into v_total
    from public.league_state_snapshots s join public.league_memberships m on m.league_id=s.league_id
    where m.user_id=auth.uid();
    perform public.set_badge_progress(auth.uid(),v_code,'',v_total);
  end loop;
  with current_wins as (
    select count(*)::integer total
    from public.league_state_snapshots s join public.league_memberships lm on lm.league_id=s.league_id,
    lateral jsonb_each(coalesce(s.state->'matchResults','{}')) result
    where lm.user_id=auth.uid()
      and lower(coalesce(s.state#>>array['teams',(
        case when coalesce((result.value->>'gamesA')::integer,0)>coalesce((result.value->>'gamesB')::integer,0)
          then s.state#>>array['schedule',split_part(result.key,'-',1),split_part(result.key,'-',2),'0']
          else s.state#>>array['schedule',split_part(result.key,'-',1),split_part(result.key,'-',2),'1'] end
      ),'claimedBy'],''))=lower(v_name)
  ), archived_wins as (
    select coalesce(sum((standing.value->>'w')::integer),0)::integer total
    from public.league_state_snapshots s join public.league_memberships lm on lm.league_id=s.league_id,
    lateral jsonb_array_elements(coalesce(s.state->'seasonHistory','[]')) season,
    lateral jsonb_array_elements(coalesce(season.value->'standings','[]')) standing
    where lm.user_id=auth.uid() and lower(coalesce(season.value#>>array['teams',standing.value->>'id','claimedBy'],''))=lower(v_name)
  )
  select coalesce((select total from current_wins),0)+coalesce((select total from archived_wins),0) into v_total;
  perform public.set_badge_progress(auth.uid(),'career_wins','',v_total);
  for r in
    with roster_mons as (
      select mon.value mon from public.league_state_snapshots s join public.league_memberships lm on lm.league_id=s.league_id,
      lateral jsonb_each(coalesce(s.state->'rosters','{}')) rr,
      lateral jsonb_array_elements(coalesce(rr.value,'[]')) mon
      where lm.user_id=auth.uid() and lower(coalesce(s.state#>>array['teams',rr.key,'claimedBy'],''))=lower(v_name)
      union all
      select mon.value from public.league_state_snapshots s join public.league_memberships lm on lm.league_id=s.league_id,
      lateral jsonb_array_elements(coalesce(s.state->'seasonHistory','[]')) season,
      lateral jsonb_each(coalesce(season.value->'rosters','{}')) rr,
      lateral jsonb_array_elements(coalesce(rr.value,'[]')) mon
      where lm.user_id=auth.uid() and lower(coalesce(season.value#>>array['teams',rr.key,'claimedBy'],''))=lower(v_name)
    )
    select mon->>'name' subject,count(*)::integer total from roster_mons where mon->>'name' is not null group by mon->>'name'
  loop perform public.set_badge_progress(auth.uid(),'pokemon_loyalist',r.subject,r.total); end loop;
  for r in
    with roster_mons as (
      select mon.value mon from public.league_state_snapshots s join public.league_memberships lm on lm.league_id=s.league_id,
      lateral jsonb_each(coalesce(s.state->'rosters','{}')) rr,lateral jsonb_array_elements(coalesce(rr.value,'[]')) mon
      where lm.user_id=auth.uid() and lower(coalesce(s.state#>>array['teams',rr.key,'claimedBy'],''))=lower(v_name)
      union all
      select mon.value from public.league_state_snapshots s join public.league_memberships lm on lm.league_id=s.league_id,
      lateral jsonb_array_elements(coalesce(s.state->'seasonHistory','[]')) season,
      lateral jsonb_each(coalesce(season.value->'rosters','{}')) rr,
      lateral jsonb_array_elements(coalesce(rr.value,'[]')) mon
      where lm.user_id=auth.uid() and lower(coalesce(season.value#>>array['teams',rr.key,'claimedBy'],''))=lower(v_name)
    )
    select coalesce(mon->>'gen','Unknown') subject,count(*)::integer total from roster_mons group by coalesce(mon->>'gen','Unknown')
  loop if r.subject<>'Unknown' then perform public.set_badge_progress(auth.uid(),'generation_veteran',r.subject,r.total); end if; end loop;
  return public.get_my_badge_profile();
end; $$;

create or replace function public.get_my_badge_profile()
returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object(
'badges',coalesce((select jsonb_agg(jsonb_build_object('code',c.code,'name',c.name,'description',c.description,'icon',c.icon,'category',c.category,'thresholds',c.thresholds,'subject',coalesce(p.subject,''),'progress',coalesce(p.progress,0),'tier',coalesce(p.tier,0),'tier_names',c.tier_names) order by coalesce(p.tier,0) desc,coalesce(p.progress,0) desc,c.name) from public.badge_catalog c left join public.user_badge_progress p on p.badge_code=c.code and p.user_id=auth.uid()),'[]'::jsonb),
'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'code',e.badge_code,'name',c.name,'description',c.description,'icon',c.icon,'subject',e.subject,'tier',e.tier,'awarded_at',e.awarded_at) order by e.awarded_at) from public.badge_award_events e join public.badge_catalog c on c.code=e.badge_code where e.user_id=auth.uid() and e.seen_at is null),'[]'::jsonb),
'daily_three',jsonb_build_object('total',(select count(*) from public.daily_three_completions where user_id=auth.uid()),'dates',coalesce((select jsonb_agg(activity_date order by activity_date desc) from public.daily_three_completions where user_id=auth.uid()),'[]'::jsonb))
); $$;

create or replace function public.mark_badge_events_seen(p_event_ids uuid[])
returns void language sql security definer set search_path=public as $$
update public.badge_award_events set seen_at=now() where user_id=auth.uid() and id=any(p_event_ids); $$;

revoke all on function public.refresh_my_account_badges() from public,anon,authenticated;
revoke all on function public.get_my_badge_profile() from public,anon,authenticated;
revoke all on function public.mark_badge_events_seen(uuid[]) from public,anon,authenticated;
grant execute on function public.refresh_my_account_badges() to authenticated;
grant execute on function public.get_my_badge_profile() to authenticated;
grant execute on function public.mark_badge_events_seen(uuid[]) to authenticated;

insert into public.daily_three_completions(user_id,activity_date)
select poll.user_id,poll.activity_date
from (
  select a.user_id,p.poll_date activity_date from public.daily_poll_answers a join public.daily_polls p on p.id=a.poll_id
) poll
where exists(select 1 from public.daily_bracket_matchups m join public.daily_draft_brackets b on b.id=m.bracket_id where m.user_id=poll.user_id and b.game_date=poll.activity_date and m.round_number=3)
  and exists(select 1 from public.daily_quiz_answers a join public.daily_quizzes q on q.id=a.quiz_id where a.user_id=poll.user_id and q.quiz_date=poll.activity_date)
on conflict do nothing;

do $$
declare r record;
begin
  for r in select user_id,max(activity_date) activity_date from public.daily_three_completions group by user_id loop
    perform public.refresh_daily_three(r.user_id,r.activity_date);
  end loop;
end $$;

commit;

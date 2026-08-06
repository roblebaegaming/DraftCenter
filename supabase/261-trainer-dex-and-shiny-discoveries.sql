-- Personal Trainer Dex discoveries from Daily Three and hosted snake drafts.
-- Every source event can award at most once; shiny results are stored forever.

begin;

create table if not exists public.trainer_dex_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pokemon_name text not null,
  pokemon_key text not null,
  source_type text not null check (source_type in ('daily_poll','daily_bracket','daily_quiz','draft')),
  source_id text not null,
  is_shiny boolean not null default false,
  occurred_at timestamptz not null default now(),
  shiny_seen_at timestamptz,
  unique (user_id, source_type, source_id)
);

create index if not exists trainer_dex_events_user_pokemon_idx on public.trainer_dex_events(user_id,pokemon_key);
alter table public.trainer_dex_events enable row level security;
revoke all on table public.trainer_dex_events from public,anon,authenticated;

insert into public.badge_catalog(code,name,description,icon,category,thresholds) values
('pokedex_researcher','Pokédex Researcher','Discover distinct Pokémon through Daily Three and DraftCenter drafts.','📖','collection',array[25,100,250]),
('draft_collector','Draft Collector','Discover distinct Pokémon by drafting them onto your teams.','⚾','collection',array[25,100,250]),
('shiny_hunter','Shiny Hunter','Find rare shiny Pokémon through eligible Daily Three and draft discoveries.','✨','collection',array[1,5,25])
on conflict(code) do update set name=excluded.name,description=excluded.description,icon=excluded.icon,category=excluded.category,thresholds=excluded.thresholds;

create or replace function public.refresh_trainer_dex_badges(p_user uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public.set_badge_progress(p_user,'pokedex_researcher','',(select count(distinct pokemon_key)::integer from public.trainer_dex_events where user_id=p_user));
  perform public.set_badge_progress(p_user,'draft_collector','',(select count(distinct pokemon_key)::integer from public.trainer_dex_events where user_id=p_user and source_type='draft'));
  perform public.set_badge_progress(p_user,'shiny_hunter','',(select count(distinct pokemon_key)::integer from public.trainer_dex_events where user_id=p_user and is_shiny));
end; $$;

create or replace function public.record_trainer_dex_event(p_user uuid,p_pokemon text,p_source_type text,p_source_id text,p_occurred_at timestamptz default now(),p_allow_shiny boolean default true)
returns public.trainer_dex_events language plpgsql security definer set search_path=public as $$
declare v_event public.trainer_dex_events; v_key text;
begin
  if p_user is null or nullif(trim(p_pokemon),'') is null or nullif(trim(p_source_id),'') is null then return null; end if;
  v_key:=lower(regexp_replace(trim(p_pokemon),'[^a-zA-Z0-9]+','','g'));
  insert into public.trainer_dex_events(user_id,pokemon_name,pokemon_key,source_type,source_id,is_shiny,occurred_at)
  values(p_user,trim(p_pokemon),v_key,p_source_type,trim(p_source_id),coalesce(p_allow_shiny,false) and random() < (1.0/128.0),coalesce(p_occurred_at,now()))
  on conflict(user_id,source_type,source_id) do nothing returning * into v_event;
  if v_event.id is not null then perform public.refresh_trainer_dex_badges(p_user); end if;
  return v_event;
end; $$;

create or replace function public.trainer_dex_daily_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_pokemon text;
begin
  if tg_table_name='daily_poll_answers' then
    if exists(select 1 from public.daily_polls where id=new.poll_id and answer_type='pokemon') then
      perform public.record_trainer_dex_event(new.user_id,new.answer_key,'daily_poll',new.poll_id::text,new.answered_at);
    end if;
  elsif tg_table_name='daily_quiz_answers' then
    if new.is_correct and exists(select 1 from public.pokemon_species where lower(name)=lower(new.display_answer)) then
      select name into v_pokemon from public.pokemon_species where lower(name)=lower(new.display_answer) limit 1;
      perform public.record_trainer_dex_event(new.user_id,v_pokemon,'daily_quiz',new.quiz_id::text,new.answered_at);
    end if;
  elsif new.round_number=3 then
    perform public.record_trainer_dex_event(new.user_id,new.winner,'daily_bracket',new.bracket_id::text,new.created_at);
  end if;
  return new;
end; $$;

drop trigger if exists trainer_dex_daily_poll on public.daily_poll_answers;
create trigger trainer_dex_daily_poll after insert on public.daily_poll_answers for each row execute function public.trainer_dex_daily_trigger();
drop trigger if exists trainer_dex_daily_quiz on public.daily_quiz_answers;
create trigger trainer_dex_daily_quiz after insert on public.daily_quiz_answers for each row execute function public.trainer_dex_daily_trigger();
drop trigger if exists trainer_dex_daily_bracket on public.daily_bracket_matchups;
create trigger trainer_dex_daily_bracket after insert on public.daily_bracket_matchups for each row execute function public.trainer_dex_daily_trigger();

create or replace function public.trainer_dex_draft_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_user uuid; v_pokemon text;
begin
  if tg_op='DELETE' then
    select user_id into v_user from public.trainer_dex_events where source_type='draft' and source_id=old.id::text;
    delete from public.trainer_dex_events where source_type='draft' and source_id=old.id::text;
    if v_user is not null then perform public.refresh_trainer_dex_badges(v_user); end if;
    return old;
  end if;
  select membership.user_id, pokemon.source_key into v_user,v_pokemon
  from public.teams team
  join public.league_memberships membership on membership.id=team.owner_membership_id
  join public.league_pokemon pokemon on pokemon.id=new.league_pokemon_id
  where team.id=new.team_id;
  if v_user is not null then perform public.record_trainer_dex_event(v_user,v_pokemon,'draft',new.id::text,new.created_at); end if;
  return new;
end; $$;

drop trigger if exists trainer_dex_draft_pick on public.draft_picks;
create trigger trainer_dex_draft_pick after insert or delete on public.draft_picks for each row execute function public.trainer_dex_draft_trigger();

create or replace function public.get_my_trainer_dex()
returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object(
  'summary',jsonb_build_object(
    'discovered',(select count(distinct pokemon_key) from public.trainer_dex_events where user_id=auth.uid()),
    'shinies',(select count(distinct pokemon_key) from public.trainer_dex_events where user_id=auth.uid() and is_shiny),
    'daily',(select count(distinct pokemon_key) from public.trainer_dex_events where user_id=auth.uid() and source_type like 'daily_%'),
    'drafted',(select count(distinct pokemon_key) from public.trainer_dex_events where user_id=auth.uid() and source_type='draft')
  ),
  'pokemon',coalesce((select jsonb_agg(row_data order by row_data->>'pokemon') from (
    select jsonb_build_object('pokemon',min(pokemon_name),'key',pokemon_key,'first_discovered',min(occurred_at),'last_discovered',max(occurred_at),'appearances',count(*),'shiny',bool_or(is_shiny),'daily_appearances',count(*) filter(where source_type like 'daily_%'),'draft_appearances',count(*) filter(where source_type='draft'),'sources',jsonb_agg(distinct source_type)) row_data
    from public.trainer_dex_events where user_id=auth.uid() group by pokemon_key
  ) collection),'[]'::jsonb),
  'new_shinies',coalesce((select jsonb_agg(jsonb_build_object('id',id,'pokemon',pokemon_name,'source',source_type,'occurred_at',occurred_at) order by occurred_at) from public.trainer_dex_events where user_id=auth.uid() and is_shiny and shiny_seen_at is null),'[]'::jsonb)
); $$;

create or replace function public.mark_trainer_dex_shinies_seen(p_event_ids uuid[])
returns void language sql security definer set search_path=public as $$
update public.trainer_dex_events set shiny_seen_at=now() where user_id=auth.uid() and is_shiny and id=any(p_event_ids); $$;

revoke all on function public.refresh_trainer_dex_badges(uuid) from public,anon,authenticated;
revoke all on function public.record_trainer_dex_event(uuid,text,text,text,timestamptz,boolean) from public,anon,authenticated;
revoke all on function public.trainer_dex_daily_trigger() from public,anon,authenticated;
revoke all on function public.trainer_dex_draft_trigger() from public,anon,authenticated;
revoke all on function public.get_my_trainer_dex() from public,anon,authenticated;
revoke all on function public.mark_trainer_dex_shinies_seen(uuid[]) from public,anon,authenticated;
grant execute on function public.get_my_trainer_dex() to authenticated;
grant execute on function public.mark_trainer_dex_shinies_seen(uuid[]) to authenticated;

-- Existing activity fills the collection without changing any source records.
select public.record_trainer_dex_event(a.user_id,a.answer_key,'daily_poll',a.poll_id::text,a.answered_at,false)
from public.daily_poll_answers a join public.daily_polls p on p.id=a.poll_id where p.answer_type='pokemon';
select public.record_trainer_dex_event(a.user_id,s.name,'daily_quiz',a.quiz_id::text,a.answered_at,false)
from public.daily_quiz_answers a join public.pokemon_species s on lower(s.name)=lower(a.display_answer) where a.is_correct;
select public.record_trainer_dex_event(m.user_id,m.winner,'daily_bracket',m.bracket_id::text,m.created_at,false)
from public.daily_bracket_matchups m where m.round_number=3;
select public.record_trainer_dex_event(m.user_id,lp.source_key,'draft',p.id::text,p.created_at,false)
from public.draft_picks p join public.teams t on t.id=p.team_id join public.league_memberships m on m.id=t.owner_membership_id join public.league_pokemon lp on lp.id=p.league_pokemon_id;

commit;
notify pgrst,'reload schema';

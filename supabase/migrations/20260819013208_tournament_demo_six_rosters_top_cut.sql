-- Tournament organizer demos should resemble a real Regulation M-B event:
-- six Pokemon per team, visible auction prices, five Swiss rounds, and a
-- seeded Top 8 playoff. Ordinary tournaments keep their existing settings.

begin;

create or replace function public.enforce_tournament_demo_event_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phase in ('registration', 'check-in')
     and exists (
       select 1
       from public.tournaments tournament
       where tournament.id = new.tournament_id
         and tournament.is_demo
         and tournament.visibility = 'private'
     ) then
    new.roster_size := 6;
    new.top_cut_size := 8;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_tournament_demo_event_defaults_trigger
  on public.draft_tournament_events;
create trigger enforce_tournament_demo_event_defaults_trigger
before update of phase on public.draft_tournament_events
for each row execute function public.enforce_tournament_demo_event_defaults();

create or replace function public.configure_tournament_demo_draft_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.draft_league_id is null
     or new.draft_league_id is not distinct from old.draft_league_id
     or not exists (
       select 1
       from public.tournaments tournament
       where tournament.id = new.tournament_id
         and tournament.is_demo
         and tournament.visibility = 'private'
     ) then
    return new;
  end if;

  update public.league_state_snapshots snapshot
  set state = jsonb_set(
        snapshot.state,
        '{settings}',
        coalesce(snapshot.state -> 'settings', '{}'::jsonb) || jsonb_build_object(
          'regulationId', 'reg-mb',
          'pricingPresetId', 'smogon-vgc-reg-mb-2026-06-28',
          'priceTierMax', 19,
          'allowMegas', true,
          'megaCap', 1,
          'restrictedCap', null
        ),
        true
      ),
      updated_at = now()
  where snapshot.league_id = new.draft_league_id;
  return new;
end;
$$;

drop trigger if exists configure_tournament_demo_draft_room_trigger
  on public.draft_tournament_events;
create trigger configure_tournament_demo_draft_room_trigger
after update of draft_league_id on public.draft_tournament_events
for each row execute function public.configure_tournament_demo_draft_room();

create or replace function public.fill_tournament_demo_auction(
  p_tournament_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_event public.draft_tournament_events%rowtype;
  v_state jsonb;
  v_pool jsonb;
  v_rosters jsonb := '[]'::jsonb;
  v_empty_rosters jsonb;
  v_roster jsonb;
  v_budgets jsonb;
  v_start_budgets jsonb;
  v_order jsonb;
  v_team_count integer;
  v_required integer;
  v_team_index integer;
  v_total_spend integer;
begin
  if auth.uid() is null then raise exception 'Sign in to generate the demo auction.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or not v_tournament.is_demo
     or v_tournament.visibility <> 'private'
     or v_event.draft_type <> 'auction'
     or v_event.phase not in ('draft-setup', 'drafting')
     or v_event.draft_league_id is null then
    raise exception 'Only the owner can generate a private demo auction before roster review.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The demo changed. Refresh before generating the auction.';
  end if;
  if v_event.roster_size <> 6 or v_event.top_cut_size <> 8 then
    raise exception 'Organizer demos require six Pokemon per roster and a Top 8 playoff.';
  end if;

  select count(*) into v_team_count
  from public.draft_tournament_seats seat
  where seat.event_id = v_event.id and seat.status = 'active';
  v_required := v_team_count * v_event.roster_size;

  with legal_pool as (
    select
      legal.value as legal_name,
      legal.ordinality::integer as legal_order,
      legal.value like 'Mega %' as demo_is_mega,
      4 + mod(get_byte(extensions.digest(convert_to(legal.value, 'UTF8'), 'sha256'), 0), 16) as listed_cost
    from jsonb_array_elements_text($regmb$["Venusaur","Charizard","Blastoise","Beedrill","Pidgeot","Arbok","Pikachu","Raichu","Clefable","Ninetales","Vileplume","Arcanine","Alakazam","Machamp","Victreebel","Slowbro","Gengar","Kangaskhan","Starmie","Pinsir","Tauros","Gyarados","Ditto","Vaporeon","Jolteon","Flareon","Aerodactyl","Snorlax","Dragonite","Meganium","Typhlosion","Feraligatr","Ariados","Ampharos","Azumarill","Politoed","Espeon","Umbreon","Slowking","Forretress","Steelix","Qwilfish","Scizor","Heracross","Skarmory","Houndoom","Tyranitar","Sceptile","Blaziken","Swampert","Pelipper","Gardevoir","Sableye","Mawile","Aggron","Medicham","Manectric","Sharpedo","Camerupt","Torkoal","Altaria","Milotic","Castform","Banette","Chimecho","Absol","Glalie","Metagross","Torterra","Infernape","Empoleon","Staraptor","Luxray","Roserade","Rampardos","Bastiodon","Lopunny","Spiritomb","Garchomp","Lucario","Hippowdon","Toxicroak","Abomasnow","Weavile","Rhyperior","Leafeon","Glaceon","Gliscor","Mamoswine","Gallade","Froslass","Rotom","Serperior","Emboar","Samurott","Watchog","Liepard","Simisage","Simisear","Simipour","Musharna","Excadrill","Audino","Conkeldurr","Scolipede","Whimsicott","Krookodile","Scrafty","Cofagrigus","Garbodor","Zoroark","Reuniclus","Vanilluxe","Emolga","Eelektross","Chandelure","Beartic","Stunfisk","Golurk","Hydreigon","Volcarona","Chesnaught","Delphox","Greninja","Diggersby","Talonflame","Vivillon","Pyroar","Florges","Pangoro","Furfrou","Meowstic","Aegislash","Aromatisse","Slurpuff","Malamar","Barbaracle","Dragalge","Clawitzer","Heliolisk","Tyrantrum","Aurorus","Sylveon","Hawlucha","Dedenne","Goodra","Klefki","Trevenant","Gourgeist","Avalugg","Noivern","Decidueye","Incineroar","Primarina","Toucannon","Crabominable","Toxapex","Mudsdale","Araquanid","Salazzle","Tsareena","Oranguru","Passimian","Mimikyu","Drampa","Kommo-o","Corviknight","Flapple","Appletun","Sandaconda","Polteageist","Hatterene","Grimmsnarl","Mr. Rime","Runerigus","Alcremie","Falinks","Morpeko","Dragapult","Wyrdeer","Kleavor","Basculegion","Sneasler","Overqwil","Meowscarada","Skeledirge","Quaquaval","Maushold","Garganacl","Armarouge","Ceruledge","Mega Venusaur","Mega Charizard X","Mega Charizard Y","Mega Blastoise","Mega Beedrill","Mega Pidgeot","Mega Alakazam","Mega Gengar","Mega Kangaskhan","Mega Pinsir","Mega Gyarados","Mega Aerodactyl","Mega Ampharos","Mega Steelix","Mega Scizor","Mega Heracross","Mega Houndoom","Mega Tyranitar","Mega Sceptile","Mega Blaziken","Mega Swampert","Mega Gardevoir","Mega Sableye","Mega Mawile","Mega Aggron","Mega Medicham","Mega Manectric","Mega Sharpedo","Mega Camerupt","Mega Altaria","Mega Banette","Mega Absol","Mega Glalie","Mega Metagross","Mega Lopunny","Mega Garchomp","Mega Lucario","Mega Abomasnow","Mega Gallade","Mega Audino","Mega Slowbro","Archaludon","Mega Floette","Kingambit","Sinistcha","Farigiraf","Mega Delphox","Mega Froslass","Gholdengo","Mega Raichu Y","Alolan Ninetales","Annihilape","Mega Dragonite","Mega Staraptor","Hisuian Arcanine","Mega Pyroar","Mega Scovillain","Mega Starmie","Basculegion-Female","Houndstone","Mega Glimmora","Mega Meganium","Mega Scrafty","Glimmora","Mega Clefable","Mega Excadrill","Mega Greninja","Palafin","Paldean Tauros (Water)","Rotom-Wash","Tinkaton","Mega Raichu X","Mega Skarmory","Rotom-Heat","Floette-Eternal","Hisuian Typhlosion","Mega Golurk","Mega Hawlucha","Rotom-Mow","Hisuian Zoroark","Lycanroc-Dusk","Mega Barbaracle","Mega Chandelure","Mega Chimecho","Mega Eelektross","Mega Feraligatr","Mega Meowstic","Paldean Tauros (Fire)","Mega Chesnaught","Mega Crabominable","Mega Dragalge","Mega Drampa","Mega Emboar","Espathra","Galarian Slowbro","Mega Falinks","Mega Victreebel","Orthworm","Rotom-Frost","Galarian Slowking","Hisuian Goodra","Hydrapple","Alolan Raichu","Hisuian Samurott","Mega Scolipede","Bellibolt","Hisuian Decidueye","Scovillain","Lycanroc-Midday","Mega Malamar","Paldean Tauros","Rotom-Fan","Lycanroc-Midnight","Meowstic-Female","Galarian Stunfisk","Hisuian Avalugg"]$regmb$::jsonb)
      with ordinality legal(value, ordinality)
  ), matched as (
    select distinct on (legal.legal_name)
      catalogue.*,
      legal.legal_order,
      legal.demo_is_mega,
      legal.listed_cost
    from legal_pool legal
    join public.pokemon_catalogue catalogue
      on catalogue.display_name = legal.legal_name
    order by legal.legal_name, catalogue.id
  ), ranked as (
    select matched.*,
      row_number() over (
        partition by matched.demo_is_mega
        order by md5(v_event.id::text || ':' || matched.id), matched.legal_order, matched.id
      ) as class_rank
    from matched
  ), assigned as (
    select ranked.*, (ranked.class_rank - 1)::integer as team_index, 0 as slot_index
    from ranked
    where ranked.demo_is_mega and ranked.class_rank <= v_team_count
    union all
    select ranked.*,
      floor((ranked.class_rank - 1)::numeric / (v_event.roster_size - 1))::integer as team_index,
      1 + mod((ranked.class_rank - 1)::integer, v_event.roster_size - 1) as slot_index
    from ranked
    where not ranked.demo_is_mega
      and ranked.class_rank <= v_team_count * (v_event.roster_size - 1)
  ), weighted as (
    select assigned.*,
      assigned.listed_cost
        + mod(get_byte(extensions.digest(convert_to(v_event.id::text || ':' || assigned.id, 'UTF8'), 'sha256'), 1), 6)
        as market_weight
    from assigned
  ), priced as (
    select weighted.*,
      greatest(
        1,
        floor(
          weighted.market_weight::numeric
          * (v_event.draft_budget - v_event.roster_size)
          / sum(weighted.market_weight) over (partition by weighted.team_index)
        )::integer
      ) as winning_bid
    from weighted
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', priced.id,
    'name', priced.display_name,
    'cost', priced.winning_bid,
    'listedCost', priced.listed_cost,
    't1', priced.primary_type,
    't2', priced.secondary_type,
    'bst', priced.base_stat_total,
    'spriteUrl', priced.sprite_url,
    'isMega', priced.demo_is_mega,
    'isRestricted', false,
    'acquiredVia', 'demo-auction'
  ) order by priced.team_index, priced.slot_index), '[]'::jsonb)
  into v_pool
  from priced;

  if jsonb_array_length(v_pool) <> v_required then
    raise exception 'The Regulation M-B catalogue does not contain the % unique entries needed for this demo.', v_required;
  end if;

  select jsonb_agg('[]'::jsonb order by team_index),
         jsonb_agg(v_event.draft_budget order by team_index),
         jsonb_agg(team_index order by team_index)
  into v_empty_rosters, v_start_budgets, v_order
  from generate_series(0, v_team_count - 1) team_index;

  for v_team_index in 0..v_team_count - 1 loop
    select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
    into v_roster
    from jsonb_array_elements(v_pool) with ordinality mon(value, ordinality)
    where mon.ordinality between
      v_team_index * v_event.roster_size + 1
      and (v_team_index + 1) * v_event.roster_size;
    v_rosters := v_rosters || jsonb_build_array(v_roster);
  end loop;

  select jsonb_agg(
    v_event.draft_budget - coalesce((
      select sum((mon.value ->> 'cost')::integer)
      from jsonb_array_elements(v_rosters -> team_index) mon(value)
    ), 0)
    order by team_index
  )
  into v_budgets
  from generate_series(0, v_team_count - 1) team_index;

  select coalesce(sum((mon.value ->> 'cost')::integer), 0)
  into v_total_spend
  from jsonb_array_elements(v_pool) mon(value);

  select state into v_state
  from public.league_state_snapshots
  where league_id = v_event.draft_league_id
  for update;
  if v_state is null then raise exception 'The private demo auction room is unavailable.'; end if;

  if v_event.phase = 'draft-setup' then
    v_state := v_state || jsonb_build_object(
      'locked', true,
      'draftStartedAt', floor(extract(epoch from clock_timestamp()) * 1000),
      'pool', v_pool,
      'rosters', v_empty_rosters,
      'budgets', v_start_budgets,
      'auctionNominationOrder', v_order,
      'auctionNominationIdx', 0,
      'nominationDeadline', null,
      'nominee', null,
      'paused', false,
      'pausedAt', null,
      'pauseIsOvernight', false,
      'auctionEnded', false
    );
    update public.league_state_snapshots
    set state = v_state, revision = revision + 1, updated_at = now()
    where league_id = v_event.draft_league_id;
  end if;

  v_state := v_state || jsonb_build_object(
    'locked', true,
    'pool', '[]'::jsonb,
    'rosters', v_rosters,
    'budgets', v_budgets,
    'auctionNominationOrder', v_order,
    'auctionNominationIdx', v_required,
    'nominationDeadline', null,
    'nominee', null,
    'paused', false,
    'pausedAt', null,
    'pauseIsOvernight', false,
    'auctionEnded', true
  );
  update public.league_state_snapshots
  set state = v_state, revision = revision + 1, updated_at = now()
  where league_id = v_event.draft_league_id;

  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = p_tournament_id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'tournament_demo_auction_generated',
    jsonb_build_object(
      'synthetic', true,
      'regulation_id', 'reg-mb',
      'team_count', v_team_count,
      'roster_size', v_event.roster_size,
      'pokemon_count', v_required,
      'total_spend', v_total_spend,
      'top_cut_size', v_event.top_cut_size
    )
  );

  return jsonb_build_object(
    'phase', 'roster-review',
    'regulation_id', 'reg-mb',
    'team_count', v_team_count,
    'roster_size', v_event.roster_size,
    'pokemon_count', v_required,
    'total_spend', v_total_spend,
    'top_cut_size', v_event.top_cut_size
  );
end;
$$;

create or replace function public.complete_tournament_demo_top_cut(
  p_tournament_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_event public.draft_tournament_events%rowtype;
  v_match public.tournament_matches%rowtype;
  v_winner uuid;
  v_loser uuid;
  v_completed integer := 0;
  v_guard integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in to complete the demo playoff.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or not v_tournament.is_demo
     or v_tournament.visibility <> 'private'
     or v_event.phase <> 'top-cut'
     or v_event.top_cut_size <> 8 then
    raise exception 'Only the owner can generate results for a private demo Top 8 playoff.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The demo changed. Refresh before generating playoff results.';
  end if;

  loop
    select * into v_match
    from public.tournament_matches bracket_match
    where bracket_match.tournament_id = p_tournament_id
      and bracket_match.bracket_stage = 'top-cut'
      and bracket_match.status = 'ready'
    order by bracket_match.bracket_round, bracket_match.match_number
    limit 1
    for update;
    exit when not found;

    v_guard := v_guard + 1;
    if v_guard > 7 then raise exception 'The demo playoff generator exceeded the Top 8 match count.'; end if;
    if (v_match.bracket_round + v_match.match_number) % 2 = 0 then
      v_winner := v_match.entrant_a_id;
      v_loser := v_match.entrant_b_id;
    else
      v_winner := v_match.entrant_b_id;
      v_loser := v_match.entrant_a_id;
    end if;

    update public.tournament_matches
    set status = 'complete',
        games_a = case when v_winner = v_match.entrant_a_id then (v_match.best_of + 1) / 2 else 0 end,
        games_b = case when v_winner = v_match.entrant_b_id then (v_match.best_of + 1) / 2 else 0 end,
        winner_id = v_winner,
        loser_id = v_loser,
        replay_urls = '{}',
        mvp = null,
        revision = revision + 1,
        completed_at = now()
    where id = v_match.id;
    perform public.advance_tournament_match_graph(v_match.id, v_winner, v_loser, auth.uid());
    v_completed := v_completed + 1;
  end loop;

  select * into v_event
  from public.draft_tournament_events
  where tournament_id = p_tournament_id;
  if v_event.phase <> 'complete'
     or not exists (
       select 1 from public.tournaments tournament
       where tournament.id = p_tournament_id and tournament.status = 'complete'
     ) then
    raise exception 'The demo Top 8 still contains an unresolved match.';
  end if;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'tournament_demo_top_cut_generated',
    jsonb_build_object(
      'synthetic', true,
      'top_cut_size', v_event.top_cut_size,
      'completed_matches', v_completed
    )
  );
  return jsonb_build_object(
    'phase', 'complete',
    'top_cut_size', v_event.top_cut_size,
    'completed_matches', v_completed
  );
end;
$$;

revoke all on function public.enforce_tournament_demo_event_defaults(),
  public.configure_tournament_demo_draft_room(),
  public.complete_tournament_demo_top_cut(uuid, bigint)
from public, anon, authenticated, service_role;

grant execute on function public.enforce_tournament_demo_event_defaults(),
  public.configure_tournament_demo_draft_room()
to service_role;

grant execute on function public.complete_tournament_demo_top_cut(uuid, bigint)
to authenticated, service_role;

comment on function public.complete_tournament_demo_top_cut(uuid, bigint)
is 'Owner-only synthetic fast-forward for the private organizer demo Top 8 playoff.';

commit;

notify pgrst, 'reload schema';

-- Migration 398 correctly made auction completion atomic, but its final league
-- lifecycle write used `active`, a draft-session status that has never been a
-- member of public.league_status. Repair the forward path before autonomous
-- auctions can reach it without a commissioner browser.

begin;

create or replace function public.sync_live_auction_league_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb := new.state;
  v_team_count integer;
  v_team_index integer;
  v_roster_min integer;
  v_roster_max integer;
  v_roster_count integer;
  v_budget integer;
  v_all_done boolean := true;
  v_complete boolean := false;
begin
  if coalesce(v_state #>> '{settings,draftType}', '') <> 'auction'
     or not coalesce((v_state ->> 'locked')::boolean, false) then
    return new;
  end if;

  if not coalesce((v_state ->> 'auctionEnded')::boolean, false)
     and coalesce(v_state -> 'nominee', 'null'::jsonb) = 'null'::jsonb then
    if jsonb_array_length(coalesce(v_state -> 'pool', '[]'::jsonb)) = 0 then
      v_complete := true;
    else
      v_team_count := jsonb_array_length(
        coalesce(v_state -> 'teams', '[]'::jsonb)
      );
      v_roster_min := greatest(
        1,
        public.draft_setting_nonnegative_integer(
          v_state -> 'settings',
          'rosterMin',
          1
        )
      );
      v_roster_max := greatest(
        v_roster_min,
        public.draft_setting_nonnegative_integer(
          v_state -> 'settings',
          'rosterMax',
          v_roster_min
        )
      );
      v_all_done := v_team_count > 0;

      if v_team_count > 0 then
        for v_team_index in 0..(v_team_count - 1) loop
          v_roster_count := jsonb_array_length(
            coalesce(
              v_state #> array['rosters', v_team_index::text],
              '[]'::jsonb
            )
          );
          v_budget := coalesce(
            (v_state #>> array['budgets', v_team_index::text])::integer,
            0
          );
          if v_roster_count < v_roster_min
             or (v_roster_count < v_roster_max and v_budget >= 1) then
            v_all_done := false;
            exit;
          end if;
        end loop;
      end if;
      v_complete := v_all_done;
    end if;
  else
    v_complete := coalesce((v_state ->> 'auctionEnded')::boolean, false);
  end if;

  if v_complete then
    new.state := jsonb_set(v_state, '{auctionEnded}', 'true'::jsonb, true);
    new.state := jsonb_set(
      new.state,
      '{nominationDeadline}',
      'null'::jsonb,
      true
    );
    update public.leagues
    set status = 'regular_season',
        updated_at = now()
    where id = new.league_id
      and status is distinct from 'regular_season';
  else
    update public.leagues
    set status = 'drafting',
        updated_at = now()
    where id = new.league_id
      and status is distinct from 'drafting';
  end if;

  return new;
end;
$$;

revoke all on function public.sync_live_auction_league_lifecycle()
from public, anon, authenticated, service_role;
grant execute on function public.sync_live_auction_league_lifecycle()
to service_role;

comment on function public.sync_live_auction_league_lifecycle() is
  'Keeps hosted auction snapshots and the canonical league drafting/regular-season lifecycle aligned.';

commit;

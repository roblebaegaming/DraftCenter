-- Keep hosted auction bids and completion compatible with the configured
-- roster minimum. This validates every authoritative snapshot transition,
-- including nominate, bid, resolve, end, and any future auction RPC.

create or replace function public.validate_live_auction_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_state jsonb := new.state;
  v_team_count integer;
  v_team_index integer;
  v_roster_min integer;
  v_roster_count integer;
  v_budget integer;
  v_missing integer;
  v_nominee jsonb;
  v_bidder integer;
  v_bid integer;
  v_finishing boolean;
begin
  if coalesce(v_state #>> '{settings,draftType}', '') <> 'auction'
     or not coalesce((v_state ->> 'locked')::boolean, false) then
    return new;
  end if;

  v_roster_min := greatest(
    1,
    coalesce((v_state #>> '{settings,rosterMin}')::integer, 1)
  );
  v_team_count := jsonb_array_length(coalesce(v_state -> 'teams', '[]'::jsonb));
  v_nominee := v_state -> 'nominee';
  v_bidder := case
    when v_nominee is not null and v_nominee <> 'null'::jsonb
      then (v_nominee ->> 'currentBidder')::integer
    else null
  end;
  v_bid := case
    when v_bidder is not null then (v_nominee ->> 'currentBid')::integer
    else 0
  end;
  v_finishing :=
    coalesce((v_state ->> 'auctionEnded')::boolean, false)
    or jsonb_array_length(coalesce(v_state -> 'pool', '[]'::jsonb)) = 0;

  if v_team_count > 0 then
    for v_team_index in 0..(v_team_count - 1) loop
      v_roster_count := jsonb_array_length(
        coalesce(v_state #> array['rosters', v_team_index::text], '[]'::jsonb)
      );
      v_budget := coalesce(
        (v_state #>> array['budgets', v_team_index::text])::integer,
        0
      );
      v_missing := greatest(0, v_roster_min - v_roster_count);

      if v_budget < v_missing then
        raise exception
          'Team % must preserve % budget point(s) to reach the roster minimum.',
          v_team_index + 1,
          v_missing;
      end if;

      if v_bidder = v_team_index then
        v_missing := greatest(0, v_roster_min - (v_roster_count + 1));
        if v_bid > v_budget or v_budget - v_bid < v_missing then
          raise exception
            'That bid must leave % budget point(s) for the remaining minimum roster slots.',
            v_missing;
        end if;
      end if;

      if v_finishing and v_roster_count < v_roster_min then
        raise exception
          'The auction cannot finish: team % has % of the required % Pokemon.',
          v_team_index + 1,
          v_roster_count,
          v_roster_min;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_live_auction_snapshot
  on public.league_state_snapshots;

create trigger validate_live_auction_snapshot
before update of state on public.league_state_snapshots
for each row
execute function public.validate_live_auction_snapshot();

-- Expand the existing snake Draft Tournament lifecycle from 4-16 to 4-32
-- entrants. Ordinary league size modes remain unchanged: the private
-- tournament draft room opts into the already-released 32-team expanded mode.

begin;

do $migration$
declare
  v_function regprocedure;
  v_definition text;
  v_updated text;
begin
  v_function := to_regprocedure(
    'public.create_draft_tournament(text,text,text,integer,integer,text,integer,integer,integer,boolean,integer,boolean)'
  );
  if v_function is null then
    raise exception 'create_draft_tournament was not found.';
  end if;
  select pg_get_functiondef(v_function) into v_definition;
  if strpos(v_definition, 'p_entrant_limit not between 4 and 16') = 0 then
    raise exception 'The snake Draft Tournament creation guard no longer matches the reviewed baseline.';
  end if;
  v_updated := replace(
    v_definition,
    'p_entrant_limit not between 4 and 16',
    'p_entrant_limit not between 4 and 32'
  );
  execute v_updated;

  v_function := to_regprocedure(
    'public.lock_draft_tournament_field(uuid,bigint)'
  );
  if v_function is null then
    raise exception 'lock_draft_tournament_field was not found.';
  end if;
  select pg_get_functiondef(v_function) into v_definition;
  if strpos(
       v_definition,
       'v_count not between 4 and 16 or v_count > v_tournament.entrant_limit'
     ) = 0
     or strpos(
       v_definition,
       'A snake Draft Tournament needs between 4 and 16 checked-in entrants within its configured capacity.'
     ) = 0
     or strpos(v_definition, '''leagueSize'', v_count,') = 0
     or strpos(v_definition, 'case when v_count <= 8 then 3 else 4 end') = 0 then
    raise exception 'The snake Draft Tournament field lock no longer matches the reviewed baseline.';
  end if;
  v_updated := replace(
    v_definition,
    'v_count not between 4 and 16 or v_count > v_tournament.entrant_limit',
    'v_count not between 4 and 32 or v_count > v_tournament.entrant_limit'
  );
  v_updated := replace(
    v_updated,
    'A snake Draft Tournament needs between 4 and 16 checked-in entrants within its configured capacity.',
    'A snake Draft Tournament needs between 4 and 32 checked-in entrants within its configured capacity.'
  );
  v_updated := replace(
    v_updated,
    '''leagueSize'', v_count,',
    '''leagueSize'', v_count,
      ''leagueScaleMode'', ''expanded'','
  );
  v_updated := replace(
    v_updated,
    'case when v_count <= 8 then 3 else 4 end',
    'case when v_count <= 8 then 3 when v_count <= 16 then 4 else 5 end'
  );
  execute v_updated;

  v_function := to_regprocedure(
    'public.build_draft_first_elimination_bracket(uuid,uuid)'
  );
  if v_function is null then
    raise exception 'build_draft_first_elimination_bracket was not found.';
  end if;
  select pg_get_functiondef(v_function) into v_definition;
  if strpos(
       v_definition,
       'v_maximum := case when v_event.draft_type = ''auction'' then 32 else 16 end;'
     ) = 0 then
    raise exception 'The draft-first elimination size guard no longer matches the reviewed baseline.';
  end if;
  v_updated := replace(
    v_definition,
    'v_maximum := case when v_event.draft_type = ''auction'' then 32 else 16 end;',
    'v_maximum := 32;'
  );
  execute v_updated;
end;
$migration$;

comment on function public.create_draft_tournament(
  text, text, text, integer, integer, text, integer, integer,
  integer, boolean, integer, boolean
) is 'Creates a 4-32 entrant snake Draft Tournament using the expanded private draft-room capacity.';
comment on function public.lock_draft_tournament_field(uuid, bigint)
is 'Locks 4-32 checked-in snake entrants, provisions an expanded private draft room, and assigns three to five Swiss rounds.';
comment on function public.build_draft_first_elimination_bracket(uuid, uuid)
is 'Builds the selected draft-first elimination bracket for a validated 4-32 entrant snake or auction field.';

commit;

notify pgrst, 'reload schema';

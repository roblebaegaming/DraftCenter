-- Cover the foreign-key sides of participation-history joins and cascades.
-- These service-only audit tables retain their existing lookup indexes; the
-- focused indexes below cover the independent actor and entrant relationships.

create index league_participation_events_actor_id_idx
  on public.league_participation_events (actor_id);

create index tournament_participation_events_actor_id_idx
  on public.tournament_participation_events (actor_id);

create index tournament_participation_events_entrant_id_tournament_id_idx
  on public.tournament_participation_events (entrant_id, tournament_id);

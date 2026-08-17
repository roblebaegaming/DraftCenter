-- Queue swaps and compaction temporarily reuse an occupied position before
-- the other row moves. Check uniqueness at transaction end, when the final
-- queue ordering is valid, instead of after each intermediate row update.

begin;

alter table public.private_draft_queue_items
  drop constraint if exists private_draft_queue_items_league_id_user_id_team_index_posi_key;

alter table public.private_draft_queue_items
  add constraint private_draft_queue_items_league_id_user_id_team_index_posi_key
  unique (league_id, user_id, team_index, position)
  deferrable initially deferred;

commit;


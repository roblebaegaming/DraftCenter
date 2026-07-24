-- Restore the active, staff-checked live draft entry point.
-- The lower-level start_snake_draft function remains inaccessible directly.

begin;

revoke all on function public.provision_live_snake_draft(
  uuid, jsonb, jsonb, integer[], integer, jsonb
) from public, anon, authenticated;

grant execute on function public.provision_live_snake_draft(
  uuid, jsonb, jsonb, integer[], integer, jsonb
) to authenticated;

revoke all on function public.get_live_snake_draft(uuid)
  from public, anon, authenticated;

grant execute on function public.get_live_snake_draft(uuid)
  to authenticated;

commit;

notify pgrst, 'reload schema';

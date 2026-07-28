-- Restore the notification queue timestamp expected by the atomic dispatcher.
-- Production reached migration 236 without this column even though migration 059
-- defines it. Keep the repair forward-only; do not rewrite applied migrations.

begin;

do $$
begin
  if to_regclass('public.notification_events') is null then
    raise exception 'Migration 059 is required: public.notification_events does not exist.';
  end if;
end;
$$;

alter table public.notification_events
  add column if not exists created_at timestamptz not null default now();

commit;

-- Personal Discord authorization no longer requests or retains server lists.
-- League server connections remain separate in league_discord_settings.

begin;

update public.discord_user_connections
set manageable_guilds = '[]'::jsonb,
    updated_at = now()
where manageable_guilds <> '[]'::jsonb;

comment on column public.discord_user_connections.manageable_guilds is
  'Retained temporarily for schema compatibility; personal OAuth stores an empty array.';

commit;

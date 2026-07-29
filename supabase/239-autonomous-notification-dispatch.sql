-- Run the reliable notification dispatcher independently of signed-in browsers.
--
-- Before applying this migration, create these encrypted Vault secrets:
--   draftcenter_notification_dispatch_url
--     Example: https://draftcenter-discord-preview.vercel.app/api/notifications/dispatch
--   draftcenter_notification_cron_secret
--     Must match CRON_SECRET in the corresponding Vercel environment.
--   draftcenter_vercel_automation_bypass_secret (protected Previews only)
--     A Vercel Protection Bypass for Automation value.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault;

create or replace function public.invoke_notification_dispatch()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_url text;
  v_secret text;
  v_bypass_secret text;
  v_headers jsonb;
  v_request_id bigint;
begin
  select decrypted_secret
    into v_url
    from vault.decrypted_secrets
   where name = 'draftcenter_notification_dispatch_url';

  select decrypted_secret
    into v_secret
    from vault.decrypted_secrets
   where name = 'draftcenter_notification_cron_secret';

  select decrypted_secret
    into v_bypass_secret
    from vault.decrypted_secrets
   where name = 'draftcenter_vercel_automation_bypass_secret';

  if nullif(trim(v_url), '') is null or nullif(trim(v_secret), '') is null then
    raise exception 'DraftCenter notification dispatcher Vault secrets are not configured.';
  end if;

  v_headers := jsonb_build_object(
    'Authorization', 'Bearer ' || v_secret,
    'Accept', 'application/json'
  );
  if nullif(trim(v_bypass_secret), '') is not null then
    v_headers := v_headers || jsonb_build_object(
      'x-vercel-protection-bypass', v_bypass_secret
    );
  end if;

  select net.http_get(
    url := v_url,
    headers := v_headers,
    timeout_milliseconds := 55000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.invoke_notification_dispatch() from public, anon, authenticated;
grant execute on function public.invoke_notification_dispatch() to service_role;

do $$
declare
  v_existing_job bigint;
  v_has_url boolean;
  v_has_secret boolean;
begin
  select exists(
    select 1 from vault.decrypted_secrets
     where name = 'draftcenter_notification_dispatch_url'
       and nullif(trim(decrypted_secret), '') is not null
  ) into v_has_url;

  select exists(
    select 1 from vault.decrypted_secrets
     where name = 'draftcenter_notification_cron_secret'
       and nullif(trim(decrypted_secret), '') is not null
  ) into v_has_secret;

  select jobid
    into v_existing_job
    from cron.job
   where jobname = 'draftcenter-notification-dispatch'
   limit 1;

  if v_existing_job is not null then
    perform cron.unschedule(v_existing_job);
  end if;

  if v_has_url and v_has_secret then
    perform cron.schedule(
      'draftcenter-notification-dispatch',
      '* * * * *',
      'select public.invoke_notification_dispatch()'
    );
  else
    raise notice 'Vault secrets are missing; the autonomous notification dispatcher was not scheduled.';
  end if;
end;
$$;

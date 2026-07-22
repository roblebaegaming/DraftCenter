-- DraftCenter milestone 15: optional public league cover images.
-- Run after the earlier DraftCenter migrations.

alter table public.leagues add column if not exists image_url text;

create or replace function public.update_league_image(
  p_league_id uuid,
  p_image_url text default null
)
returns public.leagues
language plpgsql security definer set search_path = public
as $$
declare v_league public.leagues;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can update a league image.';
  end if;
  if nullif(trim(p_image_url), '') is not null and trim(p_image_url) !~ '^https?://' then
    raise exception 'League image must be a full https:// or http:// URL.';
  end if;
  update public.leagues
  set image_url = nullif(trim(p_image_url), ''), updated_at = now()
  where id = p_league_id
  returning * into v_league;
  return v_league;
end;
$$;

grant execute on function public.update_league_image(uuid, text) to authenticated;

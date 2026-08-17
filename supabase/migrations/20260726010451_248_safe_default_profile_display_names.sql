-- Keep Auth signups valid when an email local part or supplied metadata does
-- not fit the public.profiles display-name length constraint.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(split_part(split_part(coalesce(new.email, ''), '@', 1), '+', 1)), ''),
    'Coach'
  );
  v_display_name := btrim(left(v_display_name, 40));

  if char_length(v_display_name) < 2 then
    v_display_name := 'Coach';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, v_display_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

commit;

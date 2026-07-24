-- Give league staff a safe member list for commissioner-tool dropdowns.

begin;

create or replace function public.get_league_tool_members(p_league_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.is_league_staff(p_league_id) then
      '[]'::jsonb
    else coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'membership_id', m.id,
          'username', p.username,
          'display_name', p.display_name,
          'role', m.role,
          'team_name', t.name
        )
        order by
          case m.role
            when 'commissioner' then 1
            when 'co_commissioner' then 2
            when 'coach' then 3
            else 4
          end,
          coalesce(p.display_name, p.username)
      )
      from public.league_memberships m
      join public.profiles p on p.id = m.user_id
      left join public.teams t on t.owner_membership_id = m.id
      where m.league_id = p_league_id
        and m.role in ('commissioner', 'co_commissioner', 'coach')
    ), '[]'::jsonb)
  end;
$$;

revoke all on function public.get_league_tool_members(uuid)
  from public, anon, authenticated;

grant execute on function public.get_league_tool_members(uuid)
  to authenticated;

commit;

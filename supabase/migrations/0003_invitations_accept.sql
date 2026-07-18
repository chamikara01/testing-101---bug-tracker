-- ============================================================================
-- Testing 101 Bug Tracker — migration 0003
-- Replace silent auto-join with an explicit accept / decline flow.
-- Run in the Supabase SQL editor after 0001 and 0002.
-- ============================================================================

-- 1. New users no longer auto-join projects they were invited to. The signup
--    trigger now only mirrors the profile; the invite stays pending until the
--    user accepts it in the app.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- 2. The old auto-resolve RPC is no longer used.
drop function if exists public.resolve_my_invites();

-- 3. List the current user's pending invitations, including the project name.
--    SECURITY DEFINER so invitees can see the project name before they're a
--    member (projects RLS would otherwise hide it).
create or replace function public.my_invitations()
returns table (
  invite_id uuid,
  project_id uuid,
  project_name text,
  role text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select i.id, i.project_id, p.name, i.role, i.created_at
  from public.project_invites i
  join public.projects p on p.id = i.project_id
  where lower(i.email) = lower(auth.email())
  order by i.created_at desc;
$$;

-- 4. Accept an invitation: create the membership, then remove the invite.
--    SECURITY DEFINER so the invitee (not yet a member/owner) can add their own
--    membership — but only when a matching invite for their email exists.
create or replace function public.accept_invite(pid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select role into inv_role
  from public.project_invites
  where project_id = pid and lower(email) = lower(auth.email())
  limit 1;

  if inv_role is null then
    raise exception 'No invitation found for you on this project';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (pid, auth.uid(), inv_role)
  on conflict (project_id, user_id) do nothing;

  delete from public.project_invites
  where project_id = pid and lower(email) = lower(auth.email());
end;
$$;

grant execute on function public.my_invitations() to authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;

-- (Declining an invite is a plain DELETE from project_invites, already allowed
--  by RLS for the invited email — no function needed.)

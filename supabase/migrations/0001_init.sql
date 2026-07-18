-- ============================================================================
-- Testing 101 Bug Tracker — initial schema, RLS, storage, triggers
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Idempotent-ish: safe to re-run in a fresh project. Uses IF NOT EXISTS where
-- practical and drops/recreates policies + functions.
-- ============================================================================

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 200),
  description text,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.bugs (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects (id) on delete cascade,
  title              text not null check (char_length(title) between 1 and 300),
  steps_to_reproduce text[] not null default '{}',
  expected_result    text,
  actual_result      text,
  url                text,
  severity           text not null default 'minor'
                       check (severity in ('critical', 'major', 'minor', 'trivial')),
  priority           text not null default 'medium'
                       check (priority in ('high', 'medium', 'low')),
  browser            text,
  os                 text,
  status             text not null default 'open'
                       check (status in ('open', 'in_progress', 'fixed', 'closed')),
  reporter_id        uuid not null references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.bug_screenshots (
  id           uuid primary key default gen_random_uuid(),
  bug_id       uuid not null references public.bugs (id) on delete cascade,
  storage_path text not null,
  caption      text,
  created_at   timestamptz not null default now()
);

-- Pending invitations. A row is created when an owner invites an email that
-- either has no account yet, or (transiently) before membership is granted.
-- Resolved to a project_members row when the invited user signs up/logs in.
create table if not exists public.project_invites (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email      text not null,
  role       text not null default 'member' check (role in ('owner', 'member')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, email)
);

-- Lightweight mirror of auth.users so co-members can see each other's email
-- (regular clients cannot read auth.users directly).
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_project_members_user on public.project_members (user_id);
create index if not exists idx_bugs_project on public.bugs (project_id);
create index if not exists idx_bugs_status on public.bugs (status);
create index if not exists idx_bugs_severity on public.bugs (severity);
create index if not exists idx_bugs_priority on public.bugs (priority);
create index if not exists idx_bug_screenshots_bug on public.bug_screenshots (bug_id);
create index if not exists idx_project_invites_email on public.project_invites (lower(email));
create index if not exists idx_project_invites_project on public.project_invites (project_id);

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they bypass RLS and avoid the classic
-- "policy queries its own table" infinite-recursion problem).
-- ----------------------------------------------------------------------------

create or replace function public.is_project_member(pid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = pid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(pid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects p
    where p.id = pid and p.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.project_members m
    where m.project_id = pid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function public.can_access_bug(bid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.bugs b
    join public.project_members m on m.project_id = b.project_id
    where b.id = bid and m.user_id = auth.uid()
  );
$$;

-- True if auth.uid() shares at least one project with the target user.
create or replace function public.shares_project(target uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.project_members me
    join public.project_members them on them.project_id = me.project_id
    where me.user_id = auth.uid() and them.user_id = target
  );
$$;

grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.is_project_owner(uuid)  to authenticated;
grant execute on function public.can_access_bug(uuid)    to authenticated;
grant execute on function public.shares_project(uuid)    to authenticated;

-- Convert any pending invites for the CURRENT user's email into memberships.
-- Called by the app on load so that users who were invited *before* they had an
-- account (resolved by the auth trigger) and users invited *after* (resolved
-- here on their next visit) both get added. Safe & idempotent.
create or replace function public.resolve_my_invites()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.project_members (project_id, user_id, role)
  select i.project_id, auth.uid(), i.role
  from public.project_invites i
  where lower(i.email) = lower(auth.email())
  on conflict (project_id, user_id) do nothing;

  delete from public.project_invites i
  where lower(i.email) = lower(auth.email());
end;
$$;

grant execute on function public.resolve_my_invites() to authenticated;

-- ----------------------------------------------------------------------------
-- updated_at trigger for bugs
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bugs_updated_at on public.bugs;
create trigger trg_bugs_updated_at
  before update on public.bugs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Auto-add project owner as a member on project creation
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_projects_add_owner on public.projects;
create trigger trg_projects_add_owner
  after insert on public.projects
  for each row execute function public.handle_new_project();

-- ----------------------------------------------------------------------------
-- Resolve pending invites when a user signs up.
-- Any project_invites matching the new user's email become memberships.
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mirror the new user into profiles for co-member email lookups.
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  -- Convert any pending invites addressed to this email into memberships.
  insert into public.project_members (project_id, user_id, role)
  select i.project_id, new.id, i.role
  from public.project_invites i
  where lower(i.email) = lower(new.email)
  on conflict (project_id, user_id) do nothing;

  delete from public.project_invites i
  where lower(i.email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.bugs            enable row level security;
alter table public.bug_screenshots enable row level security;
alter table public.project_invites enable row level security;
alter table public.profiles        enable row level security;

-- profiles: readable to yourself and to anyone you share a project with.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_project(id));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- projects -------------------------------------------------------------------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (owner_id = auth.uid() or public.is_project_member(id));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (public.is_project_owner(id))
  with check (public.is_project_owner(id));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using (owner_id = auth.uid());

-- project_members ------------------------------------------------------------
drop policy if exists members_select on public.project_members;
create policy members_select on public.project_members
  for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists members_insert on public.project_members;
create policy members_insert on public.project_members
  for insert to authenticated
  with check (public.is_project_owner(project_id));

drop policy if exists members_update on public.project_members;
create policy members_update on public.project_members
  for update to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

drop policy if exists members_delete on public.project_members;
create policy members_delete on public.project_members
  for delete to authenticated
  using (public.is_project_owner(project_id) or user_id = auth.uid());

-- bugs -----------------------------------------------------------------------
drop policy if exists bugs_select on public.bugs;
create policy bugs_select on public.bugs
  for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists bugs_insert on public.bugs;
create policy bugs_insert on public.bugs
  for insert to authenticated
  with check (public.is_project_member(project_id) and reporter_id = auth.uid());

drop policy if exists bugs_update on public.bugs;
create policy bugs_update on public.bugs
  for update to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists bugs_delete on public.bugs;
create policy bugs_delete on public.bugs
  for delete to authenticated
  using (public.is_project_member(project_id));

-- bug_screenshots ------------------------------------------------------------
drop policy if exists screenshots_select on public.bug_screenshots;
create policy screenshots_select on public.bug_screenshots
  for select to authenticated
  using (public.can_access_bug(bug_id));

drop policy if exists screenshots_insert on public.bug_screenshots;
create policy screenshots_insert on public.bug_screenshots
  for insert to authenticated
  with check (public.can_access_bug(bug_id));

drop policy if exists screenshots_delete on public.bug_screenshots;
create policy screenshots_delete on public.bug_screenshots
  for delete to authenticated
  using (public.can_access_bug(bug_id));

-- project_invites ------------------------------------------------------------
drop policy if exists invites_select on public.project_invites;
create policy invites_select on public.project_invites
  for select to authenticated
  using (public.is_project_owner(project_id) or lower(email) = lower(auth.email()));

drop policy if exists invites_insert on public.project_invites;
create policy invites_insert on public.project_invites
  for insert to authenticated
  with check (public.is_project_owner(project_id));

drop policy if exists invites_delete on public.project_invites;
create policy invites_delete on public.project_invites
  for delete to authenticated
  using (public.is_project_owner(project_id) or lower(email) = lower(auth.email()));

-- ----------------------------------------------------------------------------
-- Storage: private bucket for screenshots.
-- Objects are keyed as "<bug_id>/<filename>". Access is granted to any member
-- of the project that owns the bug. The app serves images via signed URLs.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('bug-screenshots', 'bug-screenshots', false)
on conflict (id) do nothing;

drop policy if exists screenshot_objects_select on storage.objects;
create policy screenshot_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bug-screenshots'
    and public.can_access_bug(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists screenshot_objects_insert on storage.objects;
create policy screenshot_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bug-screenshots'
    and public.can_access_bug(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists screenshot_objects_delete on storage.objects;
create policy screenshot_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bug-screenshots'
    and public.can_access_bug(((storage.foldername(name))[1])::uuid)
  );

-- ----------------------------------------------------------------------------
-- Backfill: mirror any pre-existing auth users into profiles.
-- ----------------------------------------------------------------------------
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do update set email = excluded.email;

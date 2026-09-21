-- ============================================================================
-- Portals & sections
-- ============================================================================
-- Two independent, optional ways to locate a bug inside a project:
--
--   * project_sections  - the areas/screens a project is split into. Every
--                         project will usually have some; the team names them.
--   * project_portals   - only for projects that ship more than one front end
--                         (admin portal, customer portal, ...). Most projects
--                         have zero rows here and never see the field.
--
-- Nothing is seeded: a new project starts with no portals and no sections.
--
-- A bug may reference either, both, or neither. The foreign keys are composite
-- (`(x_id, project_id)` -> `(id, project_id)`) so Postgres itself rejects a bug
-- pointing at a portal or section that belongs to a different project.
--
-- Run this in the Supabase SQL editor (or `supabase db push`) after 0005.
-- ============================================================================

-- Tables ---------------------------------------------------------------------

create table if not exists public.project_portals (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  position   int not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, name),
  -- Composite target for bugs.portal_id; redundant as a key, required as a
  -- foreign-key reference.
  unique (id, project_id)
);

create table if not exists public.project_sections (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  position   int not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, name),
  unique (id, project_id)
);

create index if not exists idx_portals_project  on public.project_portals (project_id);
create index if not exists idx_sections_project on public.project_sections (project_id);

-- Bug link -------------------------------------------------------------------

alter table public.bugs
  add column if not exists portal_id  uuid,
  add column if not exists section_id uuid;

-- `on delete set null (col)` names a single column: a plain SET NULL would try
-- to null project_id too (it is part of the composite key) and fail NOT NULL.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bugs_portal_fk') then
    alter table public.bugs
      add constraint bugs_portal_fk foreign key (portal_id, project_id)
        references public.project_portals (id, project_id)
        on delete set null (portal_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bugs_section_fk') then
    alter table public.bugs
      add constraint bugs_section_fk foreign key (section_id, project_id)
        references public.project_sections (id, project_id)
        on delete set null (section_id);
  end if;
end;
$$;

create index if not exists idx_bugs_portal  on public.bugs (portal_id);
create index if not exists idx_bugs_section on public.bugs (section_id);

-- RLS ------------------------------------------------------------------------
-- Any member reads the structure (they pick from it when filing a bug); only
-- owners change it, matching how members and invitations are governed.

alter table public.project_portals  enable row level security;
alter table public.project_sections enable row level security;

drop policy if exists portals_select on public.project_portals;
create policy portals_select on public.project_portals
  for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists portals_insert on public.project_portals;
create policy portals_insert on public.project_portals
  for insert to authenticated
  with check (public.is_project_owner(project_id));

drop policy if exists portals_update on public.project_portals;
create policy portals_update on public.project_portals
  for update to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

drop policy if exists portals_delete on public.project_portals;
create policy portals_delete on public.project_portals
  for delete to authenticated
  using (public.is_project_owner(project_id));

drop policy if exists sections_select on public.project_sections;
create policy sections_select on public.project_sections
  for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists sections_insert on public.project_sections;
create policy sections_insert on public.project_sections
  for insert to authenticated
  with check (public.is_project_owner(project_id));

drop policy if exists sections_update on public.project_sections;
create policy sections_update on public.project_sections
  for update to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

drop policy if exists sections_delete on public.project_sections;
create policy sections_delete on public.project_sections
  for delete to authenticated
  using (public.is_project_owner(project_id));

-- Activity log ---------------------------------------------------------------
-- Same function as 0005, with portal/section added to the changed-field list
-- so moving a bug between areas shows up in its history.

create or replace function public.log_bug_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  act text;
  changed text[] := '{}';
begin
  if tg_op = 'INSERT' then
    insert into public.bug_activity (bug_id, actor_id, action)
    values (new.id, new.reporter_id, 'created');
    return new;
  end if;

  -- UPDATE: classify by what changed.
  if old.deleted_at is null and new.deleted_at is not null then
    act := 'deleted';
  elsif old.deleted_at is not null and new.deleted_at is null then
    act := 'restored';
  else
    act := 'updated';
    if new.title              is distinct from old.title              then changed := array_append(changed, 'title'); end if;
    if new.description        is distinct from old.description        then changed := array_append(changed, 'description'); end if;
    if new.severity           is distinct from old.severity           then changed := array_append(changed, 'severity'); end if;
    if new.steps_to_reproduce is distinct from old.steps_to_reproduce then changed := array_append(changed, 'steps'); end if;
    if new.expected_result    is distinct from old.expected_result    then changed := array_append(changed, 'expected result'); end if;
    if new.actual_result      is distinct from old.actual_result      then changed := array_append(changed, 'actual result'); end if;
    if new.url                is distinct from old.url                then changed := array_append(changed, 'URL'); end if;
    if new.browser            is distinct from old.browser            then changed := array_append(changed, 'browser'); end if;
    if new.os                 is distinct from old.os                 then changed := array_append(changed, 'OS'); end if;
    if new.notes              is distinct from old.notes              then changed := array_append(changed, 'notes'); end if;
    if new.portal_id          is distinct from old.portal_id          then changed := array_append(changed, 'portal'); end if;
    if new.section_id         is distinct from old.section_id         then changed := array_append(changed, 'section'); end if;
    -- Ignore no-op saves (e.g. re-saving unchanged fields).
    if cardinality(changed) = 0 then
      return new;
    end if;
  end if;

  insert into public.bug_activity (bug_id, actor_id, action, changed_fields)
  values (new.id, auth.uid(), act, case when act = 'updated' then changed else null end);
  return new;
end;
$$;

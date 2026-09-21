-- ============================================================================
-- Sections move under portals
-- ============================================================================
-- 0006 hung sections off the project. They actually belong to a portal: the
-- admin portal and the customer portal of one product are different front ends
-- with their own screens. Two portals may happen to use the same section name
-- ("Settings"); those are still two distinct sections.
--
--   project ─< portal (>= 1) ─< section ─< bug
--
-- Portals stay invisible to teams that don't need them: every project is
-- guaranteed one portal (auto-created as "Main"), and the UI hides the portal
-- level entirely until a second one exists. The guarantee is what lets sections
-- always have a parent.
--
-- Run this in the Supabase SQL editor (or `supabase db push`) after 0006.
-- NOTE: existing sections are re-parented to their project's first portal.
-- ============================================================================

-- 1. Every project gets a portal ---------------------------------------------

insert into public.project_portals (project_id, name, position)
select p.id, 'Main', 0
from public.projects p
where not exists (
  select 1 from public.project_portals x where x.project_id = p.id
);

-- Keep that true for projects created from here on. Same function as 0001 with
-- the portal insert appended.
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

  -- Sections need a parent portal, so a project is never portal-less. The UI
  -- keeps this one hidden until the team adds a second portal.
  insert into public.project_portals (project_id, name, position)
  values (new.id, 'Main', 0)
  on conflict (project_id, name) do nothing;

  return new;
end;
$$;

-- Deleting a portal: clear its bugs first, then refuse if it was the last one.
create or replace function public.handle_portal_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The project's own deletion cascades through here, so only guard a project
  -- that is actually sticking around.
  if exists (select 1 from public.projects where id = old.project_id)
     and (select count(*) from public.project_portals
          where project_id = old.project_id) <= 1 then
    raise exception 'A project must keep at least one portal'
      using errcode = 'check_violation';
  end if;

  -- A bug's portal and section have to go together. Left to the two foreign
  -- keys, portal_id is nulled by one action and section_id by another, and the
  -- bugs_section_needs_portal check sees the row in between and rejects the
  -- delete. Clearing both in one statement keeps every intermediate state legal.
  update public.bugs
     set portal_id = null, section_id = null
   where portal_id = old.id;

  return old;
end;
$$;

drop trigger if exists trg_portals_keep_one on public.project_portals;
create trigger trg_portals_keep_one
  before delete on public.project_portals
  for each row execute function public.handle_portal_delete();

drop function if exists public.prevent_last_portal_delete();

-- 2. Re-parent sections -------------------------------------------------------

alter table public.project_sections
  add column if not exists portal_id uuid;

-- Existing sections join their project's first portal (for projects that had
-- none, the "Main" created above).
update public.project_sections s
set portal_id = (
  select p.id from public.project_portals p
  where p.project_id = s.project_id
  order by p.position, p.created_at
  limit 1
)
where s.portal_id is null;

alter table public.project_sections
  alter column portal_id set not null;

-- The portal must belong to the section's own project: composite FK again.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sections_portal_fk') then
    alter table public.project_sections
      add constraint sections_portal_fk foreign key (portal_id, project_id)
        references public.project_portals (id, project_id) on delete cascade;
  end if;
end;
$$;

-- Names are now unique per PORTAL, not per project: "Settings" may exist in the
-- admin portal and in the customer portal, as two separate sections.
alter table public.project_sections
  drop constraint if exists project_sections_project_id_name_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_sections_portal_id_name_key') then
    alter table public.project_sections
      add constraint project_sections_portal_id_name_key unique (portal_id, name);
  end if;
  -- Composite target for bugs.section_id, which now pairs with portal_id.
  if not exists (select 1 from pg_constraint where conname = 'project_sections_id_portal_id_key') then
    alter table public.project_sections
      add constraint project_sections_id_portal_id_key unique (id, portal_id);
  end if;
end;
$$;

create index if not exists idx_sections_portal on public.project_sections (portal_id);

-- 3. Re-point the bug foreign key ---------------------------------------------
-- A bug's section must now belong to the bug's own portal (which in turn must
-- belong to its project, via the untouched bugs_portal_fk). Bugs that carry a
-- section but no portal inherit the section's portal before the key is added.

update public.bugs b
set portal_id = s.portal_id
from public.project_sections s
where b.section_id = s.id and b.portal_id is null;

alter table public.bugs drop constraint if exists bugs_section_fk;
alter table public.project_sections
  drop constraint if exists project_sections_id_project_id_key;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bugs_section_fk') then
    alter table public.bugs
      add constraint bugs_section_fk foreign key (section_id, portal_id)
        references public.project_sections (id, portal_id)
        on delete set null (section_id);
  end if;

  -- A composite FK is not enforced when any column is NULL, so without this a
  -- section could be attached with no portal and skip the check above.
  if not exists (select 1 from pg_constraint where conname = 'bugs_section_needs_portal') then
    alter table public.bugs
      add constraint bugs_section_needs_portal
        check (section_id is null or portal_id is not null);
  end if;
end;
$$;

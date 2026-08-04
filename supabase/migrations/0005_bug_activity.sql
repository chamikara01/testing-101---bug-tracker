-- ============================================================================
-- Bug activity log (history)
-- ============================================================================
-- Records who did what to each bug: reported (created), updated (with which
-- fields), moved to the recycle bin, or restored. Populated automatically by
-- triggers using auth.uid(), so every change is attributed no matter where it
-- originates. Also stamps bugs.updated_by so lists can show the last editor.
--
-- Run this in the Supabase SQL editor (or `supabase db push`) after 0004.
-- ============================================================================

-- Last editor stamp on the bug itself (cheap to read in lists).
alter table public.bugs
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

-- History table -------------------------------------------------------------
create table if not exists public.bug_activity (
  id             uuid primary key default gen_random_uuid(),
  bug_id         uuid not null references public.bugs (id) on delete cascade,
  actor_id       uuid references auth.users (id) on delete set null,
  action         text not null check (action in ('created', 'updated', 'deleted', 'restored')),
  changed_fields text[],
  created_at     timestamptz not null default now()
);

create index if not exists idx_bug_activity_bug
  on public.bug_activity (bug_id, created_at desc);

alter table public.bug_activity enable row level security;

-- Readable to any member of the bug's project. Rows are only ever written by
-- the SECURITY DEFINER trigger below, so no insert/update/delete policies.
drop policy if exists bug_activity_select on public.bug_activity;
create policy bug_activity_select on public.bug_activity
  for select to authenticated
  using (public.can_access_bug(bug_id));

-- Stamp updated_by on write (creator on insert, editor on update) -------------
create or replace function public.set_bug_updated_by()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_by := new.reporter_id;
  else
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bugs_updated_by on public.bugs;
create trigger trg_bugs_updated_by
  before insert or update on public.bugs
  for each row execute function public.set_bug_updated_by();

-- Append a history row for each change ----------------------------------------
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

drop trigger if exists trg_bug_activity on public.bugs;
create trigger trg_bug_activity
  after insert or update on public.bugs
  for each row execute function public.log_bug_activity();

-- Backfill a "created" entry for bugs that predate this log, using their
-- original reporter and creation time. Writes only to bug_activity, so it does
-- not fire the bugs triggers (and won't disturb updated_at). We intentionally
-- do NOT backfill updated_by: that UPDATE would bump every bug's updated_at.
insert into public.bug_activity (bug_id, actor_id, action, created_at)
select b.id, b.reporter_id, 'created', b.created_at
from public.bugs b
where not exists (
  select 1 from public.bug_activity a
  where a.bug_id = b.id and a.action = 'created'
);

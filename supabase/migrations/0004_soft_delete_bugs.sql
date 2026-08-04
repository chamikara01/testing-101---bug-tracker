-- ============================================================================
-- Recycle bin for bugs (soft delete)
-- ============================================================================
-- A bug with `deleted_at` set is in the project's recycle bin; NULL means it
-- is active. Moving to the bin and restoring are UPDATEs (already covered by
-- the bugs_update RLS policy for project members); permanent deletion is the
-- existing DELETE (bugs_delete). No new policies are required.
--
-- Run this in the Supabase SQL editor (or via `supabase db push`) BEFORE
-- deploying the recycle-bin feature - the app filters bug lists on this column.
-- ============================================================================

alter table public.bugs
  add column if not exists deleted_at timestamptz;

-- Speeds up the "active bugs" filter (deleted_at is null) and the recycle-bin
-- listing (deleted_at is not null).
create index if not exists idx_bugs_deleted_at on public.bugs (deleted_at);

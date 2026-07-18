-- ============================================================================
-- Testing 101 Bug Tracker — migration 0002
-- Adds Description + Notes to bugs (for the report-style exports).
-- Run this in the Supabase SQL editor after 0001_init.sql.
--
-- Note: `priority` and `status` were removed from the application UI, but the
-- columns are intentionally LEFT in place here (they are nullable/defaulted and
-- harmless) so no existing data is lost. To physically drop them, uncomment the
-- block at the bottom.
-- ============================================================================

alter table public.bugs
  add column if not exists description text,
  add column if not exists notes text;

-- Optional hard-removal of the retired columns (destructive — data loss):
-- drop index if exists public.idx_bugs_status;
-- drop index if exists public.idx_bugs_priority;
-- alter table public.bugs drop column if exists priority;
-- alter table public.bugs drop column if exists status;

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Testing 101 Bug Tracker — project conventions

Full-stack bug tracker: **Next.js 16 (App Router, `src/`) + React 19 + TypeScript strict + Tailwind v4 + Supabase**.

- **Async APIs (Next 16):** `cookies()` is async; route/page `params` and `searchParams` are Promises — always `await` them.
- **Tailwind v4:** design tokens live in `src/app/globals.css` under `@theme` (brand-*, canvas, surface, line). There is **no** `tailwind.config.js`.
- **Supabase clients:** `@/lib/supabase/server` (Server Components / routes — `await createClient()`), `@/lib/supabase/client` (client components — `createClient()`), `@/lib/supabase/admin` (service role, optional). All typed with `Database` from `@/lib/database.types` — keep that file in sync with `supabase/migrations/0001_init.sql`.
- **Pattern:** reads in Server Components; mutations in client components via the browser client + `router.refresh()`; screenshot uploads go browser → Storage directly (RLS applies). Security is enforced by Postgres RLS, not just the UI.
- **Shared building blocks:** UI primitives in `@/components/ui/*`, brand palette/badge maps in `@/lib/brand`, domain types/labels in `@/lib/types`, signed screenshot URLs via `@/lib/screenshots`.
- **No `any`, no `@ts-ignore`.** Run `npx tsc --noEmit` and `npm run build` before declaring work done.

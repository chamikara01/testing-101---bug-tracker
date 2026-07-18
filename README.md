# Testing 101 — Bug Tracker

A small full-stack bug tracker for QA/dev teams. Create **Projects**, file **Bugs**
under each project (with reproducible steps and screenshots), and **export** any bug
as a polished Word (`.docx`) or PDF report. Part of the **Testing 101** QA toolkit.

- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4
- **Backend:** Supabase (Postgres + Auth + Storage) with Row-Level Security
- **Exports:** `docx` (Word) and `@react-pdf/renderer` (PDF), rendered server-side
- **Deploy target:** Vercel

---

## Features

- **Auth** — email/password sign up & sign in, plus optional **Google / GitHub OAuth** (Supabase Auth). Unauthenticated users are redirected to `/login` by the proxy.
- **Projects** — list your projects, create new ones, and invite teammates by email.
- **Members & invites** — owners invite by email (with an optional emailed join link); the invitee signs in and explicitly **accepts or declines** the invitation from their dashboard.
- **Bugs** — per-project list, filterable by **severity**; create & edit with:
  - **Steps to Reproduce** as a dynamic, reorderable numbered list (each step is its own field) — the most prominent field in the UI and in exports.
  - Description, Expected / Actual result, URL, severity, browser, OS, and Notes.
  - **Screenshots** — multi-upload to private Supabase Storage, shown as thumbnails with a click-to-enlarge lightbox.
- **Export** — download a polished bug report as `.docx` or `.pdf`:
  - **Project report** — every bug in the project (honouring the active severity filter) as `BUG-01`, `BUG-02`… in one document.
  - **Single-bug report** — the same layout for one bug, from its detail page.
  - Each report has a title / version / date / prepared-by block, a summary, and a table per bug with a colored severity band and Description, Steps, Expected, Actual, Environment, Screenshots, and Notes rows, plus a running page header/footer.
- **Dashboard** — bugs by severity across all your projects, project shortcuts, and recently updated bugs.

---

## Quick start

### 1. Prerequisites
- Node.js 20+ and npm
- A free [Supabase](https://supabase.com) project

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
Copy the example env file and fill in your Supabase project's values
(**Supabase Dashboard → Project Settings → API**):
```bash
cp .env.local.example .env.local
```
```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
# Optional (server-only; not required by the app today):
SUPABASE_SERVICE_ROLE_KEY=
```

### 4. Apply the database schema
Open **Supabase Dashboard → SQL Editor** and run **all three** migrations, in order:

1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — all tables, indexes, RLS policies, helper functions, triggers, and the private `bug-screenshots` storage bucket.
2. [`supabase/migrations/0002_bug_report_fields.sql`](supabase/migrations/0002_bug_report_fields.sql) — adds the `description` and `notes` columns used by the report exports. **Required** — bug creation fails without it.
3. [`supabase/migrations/0003_invitations_accept.sql`](supabase/migrations/0003_invitations_accept.sql) — switches invitations to an explicit **accept / decline** flow (invitees are no longer auto-added on sign-in). **Required.**

> Using the [Supabase CLI](https://supabase.com/docs/guides/cli)? Run `supabase db push`
> (or `supabase migration up`) against your linked project — both migrations live in
> `supabase/migrations/`.

### 5. Run
```bash
npm run dev
```
Open http://localhost:3000, sign up, and create your first project.

---

## Manual Supabase dashboard configuration

Most setup is handled by the migration. You only need to check these in the dashboard:

1. **Run the migration** (step 4 above) — creates schema, RLS, triggers, and the
   `bug-screenshots` bucket (private). No manual bucket creation needed.
2. **Auth → Providers → Email** — enabled by default.
   - For the smoothest local testing, you may **turn off "Confirm email"**
     (Auth → Providers → Email) so sign-up logs you straight in. The app also
     handles the confirm-email flow if you leave it on.
3. **Auth → URL Configuration** — add your site URL(s) to **Redirect URLs** so the
   email-confirmation link and OAuth logins work:
   - `http://localhost:3000/**` for local dev
   - `https://your-app.vercel.app/**` for production
4. That's it — RLS, storage policies, and the profile/invite triggers are all created
   by the migration.

### Enable Google / GitHub sign-in (optional)

The login and signup pages already show **Continue with Google** and **Continue with
GitHub** buttons. Each just needs the provider enabled in Supabase with OAuth
credentials. In every provider's console, the **callback / redirect URL** you register
is Supabase's, not your app's:

```
https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
```

(Supabase shows this exact URL on each provider's settings page — copy it from there.)

**GitHub**
1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. *Homepage URL* = `http://localhost:3000` (or your prod URL); *Authorization callback URL* = the Supabase callback URL above.
3. Copy the **Client ID**, generate a **Client Secret**.
4. Supabase → **Authentication → Providers → GitHub** → enable, paste Client ID + Secret, **Save**.

**Google**
1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials** → **Create credentials → OAuth client ID** (configure the consent screen first if prompted).
2. Application type **Web application**; under *Authorized redirect URIs* add the Supabase callback URL above.
3. Copy the **Client ID** and **Client Secret**.
4. Supabase → **Authentication → Providers → Google** → enable, paste them, **Save**.

You can enable just one — the other button will simply return a "provider not enabled"
error until configured. New OAuth users get a `profiles` row and any pending invites
resolved automatically (same triggers as email signup).

### Enable invitation emails (optional)

Inviting a teammate always creates a pending invite (they accept it from their dashboard
after signing in). To *also* email them a branded join link, configure **one** provider.
Gmail takes priority if both are set.

**Option A — Gmail SMTP (no domain needed; emails anyone):**
1. On your Google account, enable **2-Step Verification**.
2. Google Account → **Security → App passwords** → create one (16 chars).
3. Add to `.env.local`:
   ```dotenv
   GMAIL_USER=you@gmail.com
   GMAIL_APP_PASSWORD=your-16-char-app-password
   NEXT_PUBLIC_SITE_URL=http://localhost:3000   # your prod URL in production
   ```

**Option B — Resend (needs a verified domain to email people other than yourself):**
1. Create a free [Resend](https://resend.com) account → **API Keys** → create a key.
2. Add to `.env.local`:
   ```dotenv
   RESEND_API_KEY=re_xxxxxxxx
   # onboarding@resend.dev only delivers to your own Resend account email;
   # verify a domain in Resend for real delivery, then:
   # RESEND_FROM="Testing 101 <invites@yourdomain.com>"
   RESEND_FROM="Testing 101 <onboarding@resend.dev>"
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

Then restart `npm run dev`. Without any provider, invites still work — the invitee just
doesn't receive an email.

> Emails send from a server route (`/api/projects/[projectId]/invite`) so credentials stay
> server-side. The invite row insert is guarded by RLS (owner-only).

---

## How it works (architecture notes)

- **Reads** happen in Server Components using a per-request Supabase server client
  (`src/lib/supabase/server.ts`). **Mutations** happen in client components using the
  browser client (`src/lib/supabase/client.ts`); screenshot files upload directly from
  the browser to Storage so RLS applies to the uploader.
- **Security is enforced in Postgres via RLS**, not just the UI. Membership checks use
  `SECURITY DEFINER` helper functions (`is_project_member`, `is_project_owner`,
  `can_access_bug`, `shares_project`) to avoid recursive-policy problems.
- **Screenshots** live in a **private** bucket; the app serves them via short-lived
  signed URLs (`src/lib/screenshots.ts`). Object keys are `"<bugId>/<file>"` and the
  storage policy authorizes access by the bug's project membership.
- **Invites** are email-based rows in `project_invites`. A signed-in invitee lists them
  via the `my_invitations()` RPC and explicitly **accepts** (`accept_invite()` — a
  `SECURITY DEFINER` fn that creates the membership only when a matching invite exists) or
  **declines** (deletes the row, allowed by RLS). Nobody is auto-added.
- **Profiles** (`profiles` table) mirror `auth.users` so co-members can see each
  other's email without exposing the Auth schema.
- **Exports** run in Node route handlers — `/api/bugs/[bugId]/export/{docx,pdf}`
  (single bug) and `/api/projects/[projectId]/export/{docx,pdf}` (whole project,
  with an optional `?severity=` filter). They fetch the bug(s) + screenshot bytes
  server-side and stream a downloadable file built from a shared `ReportData` model.

### Project structure
```
src/
  app/
    (app)/                     # authenticated shell (header, redirects if signed out)
      page.tsx                 # dashboard
      projects/                # projects list, create
        [projectId]/           # project shell (tabs: Bugs | Members)
          page.tsx             # bugs list + filters
          members/
          bugs/new, bugs/[bugId], bugs/[bugId]/edit
    login/  signup/  auth/callback/   # auth (outside the app shell)
    api/bugs/[bugId]/export/{docx,pdf}/route.ts
  components/  ui/, brand/, auth/, projects/, bugs/ + app-header, project-tabs
  lib/  supabase/, export/, brand.ts, types.ts, database.types.ts, screenshots.ts
supabase/migrations/0001_init.sql
public/  testing101.svg (full logo), testing101-mark.svg (badge mark)
```

---

## Deploying to Vercel
1. Push this repo to GitHub and import it in Vercel.
2. Add the same environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel project settings.
3. Add your production domain to Supabase **Auth → URL Configuration → Redirect URLs**.
4. Deploy.

## Scripts
```bash
npm run dev     # start dev server
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
```

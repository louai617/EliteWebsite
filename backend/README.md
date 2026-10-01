# ELITE Real Estate CRM

Internal CRM and REST API for ELITE Real Estate (Doha): properties (Residential / Commercial ×
Company / Private), owners, leads and the sales pipeline, clients, viewings, deals and
commission, a task tracker with daily tasks, daily activity reports, performance scoring,
Property Finder / Qatar Living imports, notes and a full activity log. It is also the backend
of the website's client portal (`frontend/`, port 3001).

**Stack:** Next.js 16 (App Router, Server Components & Server Actions) · TypeScript ·
Tailwind CSS 4 · shadcn/ui (Radix) · Prisma 7 · SQLite · Zod · React Hook Form · Lucide.

## Quick start

```bash
cd backend
npm install                 # also runs `prisma generate`
cp .env.example .env        # then set SESSION_SECRET (openssl rand -base64 32)
npx prisma migrate dev      # creates ./dev.db and applies migrations
npx prisma db seed          # realistic Doha demo data (wipes CRM tables first)
npm run dev                 # http://localhost:3002/login  (CRM + REST API at /api)
```

`DATABASE_URL` defaults to `file:./dev.db`, so `npm install` and the Prisma commands also work
before `.env` exists. `SESSION_SECRET` has a development-only fallback; production refuses to
start without it.

Production: `npm run build && npm start` (apply migrations with `npm run db:deploy`).

| App | Port | What |
| --- | --- | --- |
| `backend/` | **3002** | Staff CRM (UI) + REST API (`/api/*`) + database, auth, integrations, scheduler |
| `frontend/` | **3001** | Public website + client portal; talks to the API only (`NEXT_PUBLIC_API_URL`) |

Staff who sign in on the website are sent to the CRM; client accounts that open the CRM are
sent to the portal. On localhost both apps share the session cookie.

### Development accounts (created by the seed)

| Role    | E-mail                                                                    | Password     |
| ------- | ------------------------------------------------------------------------- | ------------ |
| Admin   | admin@elite.qa                                                            | `Admin@2026` |
| Manager | fatima@elite.qa, james@elite.qa                                           | `Elite@2026` |
| Agent   | omar@elite.qa, aisha@elite.qa, rohan@elite.qa, layla@elite.qa, youssef@elite.qa | `Elite@2026` |
| Client (portal, http://localhost:3001/en/login) | client@elite.qa                    | `Client@2026` |

Change these before using real data.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | `next typegen && tsc`, ESLint |
| `npm test` | Service test-suites (RBAC, validation, commission, hierarchy, imports, tasks, daily reports & rollover, scoring, client isolation) on a throwaway `test.db` |
| `npm run db:backup` | Online copy of the SQLite database to `backups/` (do this before migrating) |
| `npm run cron:daily` | Run the daily rollover once (for a system cron) |
| `npm run reports:backfill -- 30` | Finalize daily reports for past days that have none |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` (production) |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Drop, re-migrate and re-seed the dev database |
| `npm run db:studio` | Prisma Studio |

### Environment

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | `file:./dev.db` (SQLite, relative to `backend/`) |
| `SESSION_SECRET` | ≥ 16 chars; HMAC key for session tokens. **Required in production.** |
| `NEXT_PUBLIC_BUSINESS_TIMEZONE` | Business time zone (default `Asia/Qatar`); day boundaries for daily tasks/reports. |
| `CLIENT_APP_URL` | Website origin (default `http://localhost:3001`); CORS default and portal redirect. |
| `CORS_ORIGINS` | Optional comma-separated allow-list for browser calls to `/api`. |
| `CLIENT_PORTAL_URL` | Optional; where CLIENT accounts are sent from the CRM. |
| `SESSION_COOKIE_SAMESITE` / `SESSION_COOKIE_DOMAIN` | Optional cookie settings for split-domain deployments. |
| `SCHEDULER_ENABLED` | `false` disables the in-process daily rollover (use a cron instead). |
| `CRON_SECRET` | Enables `POST /api/cron/daily-rollover` with `Authorization: Bearer <secret>`. |
| `PROPERTY_FINDER_FEED_URL` / `PROPERTY_FINDER_API_KEY` | Optional remote JSON feed for imports (see Integrations). |
| `QATAR_LIVING_FEED_URL` / `QATAR_LIVING_API_KEY` | Same for Qatar Living. |
| `IMPORT_MAX_RECORDS` | Records per import run (default 2000). |

All of these are server-side; `.env.example` documents each one. The website only needs
public values (`frontend/.env.example`).

## What's inside

- **Dashboard** — pipeline value, commission earned, leads this month (vs last), conversion,
  inventory and pipeline counts, commission-by-month and leads-by-month charts, pipeline by
  stage, lead sources, today's/overdue tasks, upcoming viewings, recent activity and (for
  managers) team performance. Every figure is a live database query.
- **Properties** — full listing record (specs, location, 12 amenity flags, marketing/SEO),
  owner link, assigned agent, photo gallery with upload / URL / cover / reorder / remove,
  status changes, interested leads, viewings, deals, notes and timeline. Table and grid views.
- **Owners** — contact profile, properties owned and their status, active listings, past
  deals, notes, activity.
- **Leads** — Kanban pipeline (drag & drop, or "Move to" menu for keyboard/touch) and a
  table view; assignment, priority, requirements, shortlisted properties, convert to client.
- **Clients** — buyers, tenants, investors, landlords, sellers with shortlist, viewings,
  deals, tasks, source leads.
- **Viewings** — month calendar and list; confirm / complete / no-show / cancel;
  overlapping viewings for the same agent are blocked; scheduling advances the lead.
- **Deals** — sale or rental, commission = amount × %, split into agent/company shares
  from configurable settings; closing a deal marks the property Sold/Rented and the lead Won.
- **Tasks** — *My tasks*, *Team tasks* (workload per agent: open, in progress, overdue, due
  today, done today/this week, on-time rate) and *Daily tasks*. Typed tasks (posting, repost,
  call, lead response, follow-up, qualification, viewing, client follow-up…) linked to a lead,
  client, property, deal or viewing; priority, due date, start/complete/cancel/reopen,
  reassignment, notes and a full history (who created, assigned, changed and when; time to
  complete). The CRM creates tasks itself: "Respond to new lead" on assignment (SLA in
  Settings), "Conduct viewing" when a viewing is booked.
- **Daily tasks & reports** — managers define recurring daily tasks ("Make 20 calls",
  "Repost 5 listings"); they are generated per agent each business day and complete
  themselves as matching work is logged. Every agent has a daily report (calls, leads
  received/answered/converted, posted, reposted, viewings, follow-ups, tasks completed and
  outstanding) for Today / Yesterday / This week / This month / Custom, plus an end-of-day
  summary. History is kept for every day.
- **Activity tracking** — "Log activity" (calls, follow-ups, postings…) and automatic
  records from the CRM (lead contacted/qualified/won, viewing completed, listing created,
  task completed). An append-only log with de-duplication, so the same work never counts twice.
- **Performance** — leaderboard and per-agent pages: score with an itemised breakdown,
  overdue and missed work, 30-day trend; weights editable by admins.
- **Imports** — Property Finder and Qatar Living (upload a JSON export or fetch a configured
  feed), with dry runs and per-record logs.
- **Client portal accounts** — managers give a client a login from the client page; clients
  can also self-register on the website.
- **Notes & activity** — notes on any record; an append-only activity log feeding every
  timeline and the global Activity page.
- **Search** — ⌘K command palette and a results page across leads, clients, owners,
  properties (incl. by owner name), deals and users. Every list has filters, sorting,
  pagination and column visibility, all kept in the URL.

## Architecture

```
backend/
  prisma/            schema.prisma, migrations/, seed.ts
  prisma.config.ts   Prisma 7 config (datasource URL, seed command)
  src/
    app/(auth)/      login
    app/(crm)/       all CRM pages (Server Components; auth enforced in the layout)
    app/api/         REST API (see "REST API"), search, lookup, uploads
    actions/         Server Actions — thin: validate (Zod) → call a service
    services/        business logic + database access (Prisma), RBAC scoping, activity logging
    integrations/    Property Finder / Qatar Living adapters → normalized listing schema
    server/          in-process scheduler (daily rollover)
    schemas/         Zod schemas shared by forms (client) and actions (server)
    lib/             auth/session, permissions, errors, formatting, action wrapper, db client
    components/ui/   shadcn/ui primitives
    components/…     layout, shared building blocks, feature components
    hooks/ types/
  scripts/           backup, daily rollover, report backfill
  samples/           sample Property Finder / Qatar Living JSON exports
  tests/             service test-suites
```

- **Auth** — bcrypt (12 rounds) passwords; random session token in an httpOnly, SameSite=Lax
  cookie; only an HMAC of the token is stored. Sessions slide for 7 days and are revoked on
  password change, deactivation or role change. Login is rate-limited and uses constant-time
  failure paths. `proxy.ts` does an optimistic redirect; the real check runs in the CRM layout
  and in **every** Server Action / Route Handler.
- **Roles** — one permission matrix in `src/lib/permissions.ts` (`ROLE_PERMISSIONS`,
  `hasPermission`), used by pages, the sidebar, Server Actions and API routes alike:

  | Role | Access |
  | --- | --- |
  | `ADMIN` | Everything, incl. company settings, scoring weights and all users |
  | `MANAGER` | Whole team's data, assignments, task templates, team reports/performance, imports, client portal access |
  | `AGENT` | Own leads/clients/viewings/deals/tasks/reports/score; shared inventory (edits own listings) |
  | `CLIENT` | Client portal only: their own shortlist, viewings, enquiries, deals and tasks shared with them |

  Data scoping is enforced in the service layer via `scope.*` filters (a CLIENT gets an empty
  scope everywhere in the CRM) and the portal services are keyed on the session's `clientId`.
  Roles always come from the database session, never from the request.
- **Errors** — `authedAction` wraps every mutation: auth → Zod validation → service →
  revalidation. Prisma/unknown errors are logged server-side and returned as safe messages;
  field errors map back onto the form.
- **Dates** — stored in UTC; displayed and entered in Asia/Qatar regardless of server or
  browser time zone.

## REST API (`/api`, used by the website on port 3001)

Every response is `{ "ok": true, "data": … }` or `{ "ok": false, "error": { "code", "message", "fields?" } }`
(`VALIDATION` 422, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409,
`RATE_LIMITED` 429, `INTERNAL` 500 — internal details are never returned).
Auth: the httpOnly session cookie (browsers, `credentials: "include"`) or
`Authorization: Bearer <token>` (`POST /api/auth/login` with `"issueToken": true`).
Cookie-authenticated writes must come from an allowed origin (CSRF check); CORS allows
`CORS_ORIGINS` only. Bodies are JSON and validated with the same Zod schemas as the CRM.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/register` (always a CLIENT), `POST /auth/password`, `POST /auth/forgot-password` |
| Users | `GET/POST /users`, `GET/PUT /users/:id` (admins/managers) |
| Clients | `GET/POST /clients`, `GET/PUT/DELETE /clients/:id`, `GET/POST/DELETE /clients/:id/portal-access` |
| Leads | `GET/POST /leads`, `GET/PUT/DELETE /leads/:id`, `POST /leads/:id/status`, `POST /leads/:id/assign` |
| Properties | `GET/POST /properties` (filters incl. `category`, `subcategory`), `GET /properties/categories`, `GET/PATCH/DELETE /properties/:id`, `POST /properties/:id/postings` |
| Tasks | `GET/POST /tasks` (`scope=mine|team`, filters), `GET/PATCH/DELETE /tasks/:id`, `POST /tasks/:id/notes`, `POST /tasks/:id/assign`, `GET /tasks/workload`, `GET/POST /tasks/daily-templates`, `PUT/DELETE /tasks/daily-templates/:id` |
| Activities | `GET/POST /activities`, `DELETE /activities/:id` |
| Reports | `GET /reports?preset=today|yesterday|week|month|custom&from&to&agentId`, `GET /reports/daily?agentId&date`, `POST /reports/daily/submit` |
| Performance | `GET /performance`, `GET /performance/:agentId`, `GET/PUT/DELETE /performance/scoring` |
| Imports | `GET/POST /integrations/property-finder`, `GET/POST /integrations/qatar-living`, `GET /migrations`, `GET /migrations/:id` |
| Client portal | `GET /portal/overview`, `/portal/properties`, `/portal/viewings`, `/portal/leads`, `/portal/tasks`, `/portal/reports`, `/portal/activity`, `/portal/data`, `GET/PATCH /portal/account`, `POST /portal/enquiries` |
| Public | `POST /public/leads` (website forms & chat; rate-limited, honeypot), `GET /health` |
| Cron | `POST /cron/daily-rollover` (`Authorization: Bearer $CRON_SECRET`) |

The CRM UI itself uses Server Actions over the same service layer; `/api/search` and
`/api/lookup` serve its pickers.

## Daily reset (business-day rollover)

A business day is a calendar date in `NEXT_PUBLIC_BUSINESS_TIMEZONE` (Asia/Qatar), midnight
to midnight. Nothing is ever deleted at the reset:

- Activities are append-only records with their business date; today's report is computed
  live from them.
- After midnight the rollover **finalizes** each past day: every agent's counters, score and
  score breakdown are computed one last time and frozen (`DailyReport.status = FINALIZED`).
  Finalized reports are never recomputed. Daily tasks still open are marked *expired*
  (Cancelled, with a history entry) and count as missed for that day.
- Then today's daily tasks are generated.
- A `SystemJob` row per day makes it idempotent and safe with several servers; after
  downtime it catches up (up to 31 days).

How it runs:
- **Development / single server:** automatically — `src/instrumentation.ts` starts a check
  every minute in the Node server (disable with `SCHEDULER_ENABLED=false`).
- **Production with several instances or serverless:** set `SCHEDULER_ENABLED=false` and call
  the job from a scheduler a few minutes after midnight Doha time (21:05 UTC):
  `npm run cron:daily`, or `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://crm.example.com/api/cron/daily-rollover`.

## Performance scoring

Each day's score is the sum of weighted metrics (`src/lib/scoring.ts` → `SCORE_METRICS`),
e.g. +2 per task completed, −3 per overdue task, +1 per call, +3 per lead answered, +10 ×
lead response rate, +5 per viewing, +25 per conversion, +10 × daily-task completion, +5 for
submitting the daily report, up to +5 for completing tasks within 24h. Every score is stored
with its itemised breakdown, so the UI shows exactly where each point came from; weekly and
monthly scores are the sum of daily scores. Admins change weights (or switch metrics off) on
**Performance → How the score works**; changes apply to today and future days.

## Integrations (Property Finder, Qatar Living)

`src/integrations/` holds one adapter per portal (`PropertyFinderAdapter`,
`QatarLivingAdapter`) that maps raw records to a single normalized, validated listing schema
(`types.ts`: external ID, source, title, description, type, category, company/private, rent/sale,
price, currency, beds, baths, area, location, address, building, floor, furnishing, amenities,
images, agent, contact, availability, source URL, metadata, dates). The import service then:

- validates each record and logs a readable reason for every failure (a bad record never
  stops the batch); runs are recorded with per-record results (**Imports** page, `/api/migrations`);
- de-duplicates by (source, listing ID), then by listing URL; unchanged records are skipped;
- creates the property (owner from the contact for private listings, agent matched by
  e-mail, photos) or updates portal-owned fields on re-import — never reassigning or deleting;
- supports dry runs.

**Credentials.** No endpoints are hard-coded: neither portal publishes a public listings API
for agencies, so you either upload a JSON export, or set a feed URL your agency has access to
in `backend/.env`: `PROPERTY_FINDER_FEED_URL` / `PROPERTY_FINDER_API_KEY`,
`QATAR_LIVING_FEED_URL` / `QATAR_LIVING_API_KEY` (key sent as a Bearer token). The field
mappings follow Property Finder's listing feed format and a generic Qatar Living export; they
are **provisional** until checked against a real export from your accounts — adjust the keys in
the adapter files. XML feeds must be converted to JSON first. Sample files: `samples/`.

## Database changes and safe migrations

Migration `20261001103115_crm_operations` adds the property hierarchy (`category`,
`subcategory`, `lastPostedAt`), the `CLIENT` role and `User.clientId`, task fields (type,
startedAt, assignedBy, viewing, clientVisible, daily-task fields) and the new tables
`TaskEvent`, `DailyTaskTemplate`, `AgentActivity`, `DailyReport`, `ScoringRule`, `SystemJob`,
`ExternalListing`, `ImportRun`, `ImportRecord`. It copies every existing row and backfills:
commercial categories from the property type, task types from their links, `startedAt` for
in-progress tasks, `assignedById` and a "created" history event per task. Nothing is deleted.

Before migrating a database with real data: `npm run db:backup` (writes `backups/dev-<time>.db`),
then `npm run db:deploy`. To roll back, stop the server and copy the backup over the database
file. Never run `db:seed` / `db:reset` on real data — they wipe the CRM tables.

### Data model

`User` · `Session` · `Owner` · `Property` · `PropertyImage` · `PropertyInterest`
(lead/client ↔ property) · `Lead` · `Client` · `Viewing` · `Deal` · `Task` · `TaskEvent` ·
`DailyTaskTemplate` · `AgentActivity` · `DailyReport` · `ScoringRule` · `SystemJob` ·
`ExternalListing` · `ImportRun` · `ImportRecord` · `Note` · `Activity` · `Settings` ·
`Counter` (ELT-/DL- references).

cuid ids, `createdAt`/`updatedAt`, real foreign keys with deliberate `onDelete` rules
(cascade for child data, set-null for assignments, restrict where history would be lost —
e.g. a property or client with deals can't be deleted), native enums, and indexes on every
filtered/sorted column. Money is stored in whole QAR (`Int`).

## Moving to PostgreSQL later

1. `provider = "postgresql"` in `schema.prisma`, swap `@prisma/adapter-better-sqlite3` for
   `@prisma/adapter-pg` in `src/lib/db.ts` and the seed.
2. Add `mode: "insensitive"` in `src/lib/search.ts` (single place for text matching).
3. `prisma migrate dev` to create a fresh Postgres migration history.

## Known limitations

- Photo uploads are stored on local disk (`storage/uploads`, served via
  `/api/uploads/...` to signed-in users). Use object storage (S3/R2) before running several
  instances; `src/services/storage.ts` is the only file to change.
- The login rate limiter is in-memory (per process).
- No e-mail delivery yet. "Forgot password" on the website opens a task for the team, who
  verify the person and set a new password (staff: **Users**; clients: the client's
  **Client portal** card).
- The in-process scheduler suits a single server; use the cron endpoint for several instances.
- Import field mappings are provisional until verified against real portal exports.
- The seed uses Unsplash photo URLs; they need internet access to display.

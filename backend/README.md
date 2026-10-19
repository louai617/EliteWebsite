# ELITE Real Estate CRM

Internal CRM and REST API for ELITE Real Estate (Doha): properties (Residential / Commercial ×
Company / Private), owners, leads and the sales pipeline, clients, viewings, deals and
commission, a task tracker with daily tasks, daily activity reports, performance scoring,
Property Finder / Qatar Living imports, notes and a full activity log. It is also the backend
of the public website (`frontend/`, port 3001), which has no visitor accounts.

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
                            # (dev/build regenerate the Prisma client; dev also applies new migrations)
```

`DATABASE_URL` defaults to `file:./dev.db`, so `npm install` and the Prisma commands also work
before `.env` exists. `SESSION_SECRET` has a development-only fallback; production refuses to
start without it.

Production: `npm run build && npm start` (apply migrations with `npm run db:deploy`).

| App | Port | Production | What |
| --- | --- | --- | --- |
| `backend/` | **3002** | app.eliterealestate.qa | Agent app: staff CRM (UI) + REST API (`/api/*`) + database, auth, integrations, scheduler |
| `frontend/` | **3001** | eliterealestate.qa | Public website (no accounts); reads listings from `/api/public/properties`, books viewings and reservations through `/api/public/*` |

Only staff accounts can sign in (the website's **Agent portal** button opens `/login`).
Client-portal accounts created before the portal was retired are kept in the database but
can no longer sign in or reset their password.

### Development accounts (created by the seed)

| Role    | E-mail                                                                    | Password     |
| ------- | ------------------------------------------------------------------------- | ------------ |
| Admin   | admin@elite.qa                                                            | `Admin@2026` |
| Manager | fatima@elite.qa, james@elite.qa                                           | `Elite@2026` |
| Agent   | omar@elite.qa, aisha@elite.qa, rohan@elite.qa, layla@elite.qa, youssef@elite.qa | `Elite@2026` |

Change these before using real data.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | `next typegen && tsc`, ESLint |
| `npm test` | Service test-suites (RBAC, validation, commission, hierarchy, imports, tasks, daily reports & rollover, scoring, client isolation, public listings, website bookings, saved homes, recommendations, password reset, lead rules, deals, contracts, documents, reservations, listing media) on a throwaway `test.db` |
| `npm run db:backup` | Online copy of the SQLite database to `backups/` (do this before migrating) |
| `npm run import:website-listings` | Import the website's former hard-coded listings (`samples/website-listings.json`); idempotent by reference |
| `npm run photos:optimize` | Re-encode photos uploaded before the photo pipeline (upright, no metadata, WebP, thumbnails); `-- --dry-run` to preview |
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
| `APP_URL` | This app's public origin (production `https://app.eliterealestate.qa`); absolute photo URLs in the public API. Defaults to the request origin. |
| `CLIENT_APP_URL` | Website origin (default `http://localhost:3001`); CORS default, links in e-mails (property pages, private reservation links), "view on website" links. |
| `WEBSITE_REVALIDATE_SECRET` | Shared with the website's `REVALIDATE_SECRET`; enables instant website refresh after property changes. Empty = website refreshes within 60 s. |
| `WEBSITE_REVALIDATE_URL` | Optional; defaults to `CLIENT_APP_URL/api/revalidate`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Outgoing e-mail (password codes, viewing and reservation e-mails). Without `SMTP_HOST`: saved to `storage/outbox` in development, failure (+ a task for the team) in production. |
| `MAIL_FROM` / `MAIL_REPLY_TO` | Sender, e.g. `ELITE Real Estate <no-reply@eliterealestate.qa>`. |
| `CORS_ORIGINS` | Optional comma-separated allow-list for browser calls to `/api`. |
| `SESSION_COOKIE_SAMESITE` / `SESSION_COOKIE_DOMAIN` | Optional cookie settings; leave the domain unset so the staff cookie stays on the agent app host. |
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
  owner link, assigned agent, photos (see *Listing photos* below), status changes, interested leads, viewings, deals, notes and timeline. Table and grid views.
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
- **Website bookings without accounts** — visitors book viewings (a viewing on a WEBSITE lead
  with a confirm task) and reserve homes (the reservation carries their contact details and a
  private link for the Fawran / transfer receipt; only a keyed hash of the link is stored).
  A visitor who already has an open lead for the same listing (same phone) keeps that lead.
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
  | `MANAGER` | Whole team's data, assignments, task templates, team reports/performance, imports |
  | `AGENT` | Own leads/clients/viewings/deals/tasks/reports/score; shared inventory (edits own listings) |
  | `CLIENT` | Retired (old client-portal accounts): no permissions and can't sign in |

  Data scoping is enforced in the service layer via `scope.*` filters (a CLIENT gets an empty
  scope everywhere).
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
Auth (staff only): the httpOnly session cookie or `Authorization: Bearer <token>`
(`POST /api/auth/login` with `"issueToken": true`). The website only uses the `/public/*`
endpoints and sends no cookies.
Cookie-authenticated writes must come from an allowed origin (CSRF check); CORS allows
`CORS_ORIGINS` only. Bodies are JSON and validated with the same Zod schemas as the CRM.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/password`, `POST /auth/forgot-password` (e-mails a 6-digit code), `POST /auth/verify-reset-code` (→ reset token), `POST /auth/reset-password` |
| Listing media | `POST /media-upload/:propertyId?kind=VIDEO|FLOOR_PLAN|BROCHURE&title=` (raw file body, streamed to disk; staff, same-origin; skipped by the proxy), `GET /media/:id` (range requests; public while the listing is live) |
| Documents | `GET /documents/:id` (`?download=1`) — streams a file after a permission check (staff with the record in scope) |
| Users | `GET/POST /users`, `GET/PUT /users/:id` (admins/managers) |
| Clients | `GET/POST /clients`, `GET/PUT/DELETE /clients/:id` |
| Leads | `GET/POST /leads`, `GET/PUT/DELETE /leads/:id`, `POST /leads/:id/status`, `POST /leads/:id/assign` |
| Properties | `GET/POST /properties` (filters incl. `category`, `subcategory`), `GET /properties/categories`, `GET/PATCH/DELETE /properties/:id`, `POST /properties/:id/postings`, `POST /properties/:id/photos` (multipart `file`; optimized as above, returns the stored photo and `lowRes`) |
| Tasks | `GET/POST /tasks` (`scope=mine|team`, filters), `GET/PATCH/DELETE /tasks/:id`, `POST /tasks/:id/notes`, `POST /tasks/:id/assign`, `GET /tasks/workload`, `GET/POST /tasks/daily-templates`, `PUT/DELETE /tasks/daily-templates/:id` |
| Activities | `GET/POST /activities`, `DELETE /activities/:id` |
| Reports | `GET /reports?preset=today|yesterday|week|month|custom&from&to&agentId`, `GET /reports/daily?agentId&date`, `POST /reports/daily/submit` |
| Performance | `GET /performance`, `GET /performance/:agentId`, `GET/PUT/DELETE /performance/scoring` |
| Imports | `GET/POST /integrations/property-finder`, `GET/POST /integrations/qatar-living`, `GET /migrations`, `GET /migrations/:id` |
| Public | `GET /public/properties` (`q`, `purpose`, `category`, `type`, `area`, `beds`, `priceMin`, `priceMax`, `featured`, `refs` (saved homes), `sort`, `page`, `pageSize`), `GET /public/properties/:ref` (details, agent card, market data, similar homes), `POST /public/leads` (website forms & chat; rate-limited, honeypot), `GET /health` |
| Public bookings | `GET /public/viewings/slots?property&date`, `POST /public/viewings` (`property`, `startsAt`, `name`, `phone`, `email`, `note?`) |
| Public reservations | `GET /public/reservations/quote?property=REF`, `POST /public/reservations` (`method: FAWRAN`, `CARD` is "coming soon"; contact details) → `{ reference, token }`, `GET/PATCH/DELETE /public/reservations/:token` (status / payer details / cancel), `POST /public/reservations/:token/receipt` (multipart `file`) |
| Cron | `POST /cron/daily-rollover` (`Authorization: Bearer $CRON_SECRET`) |

The CRM UI itself uses Server Actions over the same service layer; `/api/search` and
`/api/lookup` serve its pickers.

### Sales workflow rules

All enforced in the service layer (board, menus, forms and API alike):

- **Viewing step** — a lead moves to *Negotiation* only with a `VIEWING_FORM` document on the
  lead or an approved `LeadPassRequest` (agents ask, managers approve; a manager's own request
  is approved at once).
- **Won** (`markLeadWon`) — requires the viewing step plus `BOOKING_FORM` and `PROOF_OF_PAYMENT`
  documents (on the lead or its client). Opens the deal as `PENDING_CONTRACT`, reserves the
  property, moves the paperwork onto the deal and gives the agent a "Prepare the contract" task.
- **Lost** (`markLeadLost`) — requires a reason (`Lead.lostReason`).
- **Deals** — `PENDING_CONTRACT → CLOSED | CANCELLED`, managers only. Closing converts the lead
  into a client (`services/lead-conversion.ts`, documents and viewings move with it), marks the
  property Sold/Rented and opens an "add the client's documents" task. Cancelling needs a
  reason, releases the property and marks the lead Lost. Manual deals are manager-only.
- **24-hour rule** — `reassignStaleLeads()` (scheduler / cron) moves leads still `NEW` with an
  agent `Settings.leadAutoReassignHours` after `Lead.assignedAt` to `leadEscalationUserId` (or
  the first admin). `bulkReassignLeads()` moves an agent's open leads in one go.
- **Contracts** — `ContractTemplate` (admin-edited text with `{{placeholders}}` + fields for
  agents) → `Contract` (rendered snapshot with its values and template version). Rendering
  escapes everything (`lib/contract-format.ts`); printable page at `/contracts/:id`.
- **Reservations** — `AWAITING_PAYMENT → PAYMENT_SUBMITTED` (client uploads the Fawran / transfer
  receipt) `→ CONFIRMED` (staff verify; property Reserved) or `CANCELLED`; unpaid ones expire
  after `Settings.reservationHoldHours`. Deposit = listing's `bookingDeposit`, else
  `saleDepositPercent` of the price or `rentDepositMonths` of rent.

### Listing photos

Photos are added in the **New property** form (picked first, uploaded right after the listing
is created) or later with **Manage photos** on the property page: drag & drop, click or paste
(Ctrl/⌘ V), up to 40 per listing, three uploads at a time with per-photo progress, retry on
network errors, drag (or arrows) to reorder, ★ to choose the cover.

- **In the browser** (`lib/photo-upload.ts`): photos over 3000 px or 2.5 MB are shrunk to a
  3000 px JPEG before sending (a 12 MP phone photo goes from ~5–10 MB to ~1–2 MB), and tiles
  use small previews instead of decoding the originals.
- **On the server** (`services/photos.ts`, sharp/libvips): the bytes are sniffed (JPG, PNG,
  WebP, AVIF; HEIC gets a "use JPG" message; SVG and anything else are refused), corrupt files
  and >100 MP images are rejected, then every photo is rotated upright, converted to sRGB,
  **stripped of all metadata (EXIF, GPS location, camera serials)**, capped at 2560 px and saved
  as WebP (q82), plus a 640 px thumbnail and a ~150-byte blurred preview. Width, height, size
  and a SHA-256 are stored: the same photo can't be added twice, photos under 480 px are
  refused and under 1600 px are flagged *Low res*.
- **Delivery**: CRM lists use the thumbnails; the website gets the blurred preview
  (`cover_blur`, `image_blurs`) and serves AVIF/WebP at the right size through Next's image
  optimizer. Removing a photo or a listing deletes its files.
- Photos uploaded before this existed: `npm run photos:optimize` (add `-- --dry-run` to preview)
  re-encodes them the same way. Photos pasted as URLs are left as they are.

### Listing media

`PropertyMedia` holds videos, 360° tours, floor plans and a brochure next to the photos
(`PropertyImage`). Links are parsed in `lib/media-links.ts`: YouTube (privacy-enhanced
embed), Vimeo, Matterport and Kuula become players; any other https link is shown as a plain
link, so listings never frame arbitrary sites. Uploads (video ≤ 200 MB, floor plan ≤ 15 MB,
brochure ≤ 30 MB) are streamed to `storage/media/<propertyId>/`, type-checked from their first
bytes, and removed with the item or the listing. `experimental.proxyClientMaxBodySize` is 12 MB
(the proxy cuts off larger bodies), which is why big uploads use their own route.

### Documents & e-mail

Documents (PDF/JPG/PNG/WebP, ≤ 10 MB, type checked from the bytes) are stored under
`storage/documents/` with random names and only served by `/api/documents/:id`
(`Content-Security-Policy: sandbox`, `no-store`). Only managers delete them; uploads and deletes
are in the activity log. E-mails use branded templates (`services/email-templates.ts`, logo
attached inline) sent by `services/mail.ts`; every attempt is logged in `EmailLog` without the
body. Password codes and reset tokens are stored only as keyed hashes (`OtpCode`).

### Website sync

A property is public when `websitePublished` is on and its status is `AVAILABLE` or
`RESERVED`; the public endpoints select safe fields only (never owner, commission or internal
notes). Photos of public listings are served from `/api/uploads/...` without a session; all
other uploads still need one. Every property, image, deal and import change calls
`notifyWebsite()` (`src/services/website-sync.ts`, debounced), which POSTs to the website's
`/api/revalidate`. Publishing records a *Property post* activity (outcome "Website") for the
agent's daily report. Website bookings are `SCHEDULED` viewings with `bookedByClient`; they
create a *Confirm website booking* task that confirming the viewing completes.

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

Migration `20261004093500_website_portal` adds the website fields to `Property`
(`websitePublished` — on for existing listings, `websitePublishedAt` backfilled from
`createdAt`, Arabic title/description, exclusive/verified, completion, ownership, amenities,
highlights, nearby, payment plan …), `Viewing.bookedByClient`/`clientNote`,
`PropertyInterest.priceAtSave` (backfilled with the current price) and client search
preferences. Every row is copied; nothing is deleted.

Migration `20261014113605_lead_rules_documents_contracts` adds `Document`, `LeadPassRequest`,
`OtpCode`, `EmailLog`, `Reservation`, `ContractTemplate` and `Contract`, lead fields
(`lostReason`, `assignedAt`, `autoReassignedAt`), payment settings, `Property.bookingDeposit`
and makes `Deal.clientId` optional. Deal statuses are mapped (Negotiation / Contract pending /
Contract signed → Pending contract, Closed won → Closed, Closed lost → Cancelled with a note);
`assignedAt` starts at migration time. Nothing is deleted.

Before migrating a database with real data: `npm run db:backup` (writes `backups/dev-<time>.db`),
then `npm run db:deploy`. To roll back, stop the server and copy the backup over the database
file. Never run `db:seed` / `db:reset` on real data — they wipe the CRM tables.

### Data model

`User` · `Session` · `Owner` · `Property` · `PropertyImage` · `PropertyInterest`
(lead/client ↔ property) · `Lead` · `Client` · `Viewing` · `Deal` · `Task` · `TaskEvent` ·
`DailyTaskTemplate` · `AgentActivity` · `DailyReport` · `ScoringRule` · `SystemJob` ·
`PropertyMedia` · `Document` · `LeadPassRequest` · `Reservation` · `ContractTemplate` · `Contract` · `OtpCode` · `EmailLog` ·
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
  `/api/uploads/...`; public only while the listing is live on the website). Use object storage (S3/R2) before running several
  instances; `src/services/storage.ts` is the only file to change.
- The login rate limiter is in-memory (per process).
- E-mail needs an SMTP account (`SMTP_*`). Until it is set, production password resets fall back
  to a task for the team.
- Online card payments are not connected yet ("coming soon"); reservations are paid by Fawran /
  bank transfer and verified by staff.
- Documents and listing media are stored on local disk like photos; move them to object storage
  before running several instances.
- The in-process scheduler suits a single server; use the cron endpoint for several instances.
- Import field mappings are provisional until verified against real portal exports.
- The seed uses Unsplash photo URLs; they need internet access to display.

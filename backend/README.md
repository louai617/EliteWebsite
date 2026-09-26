# ELITE Real Estate CRM

Internal CRM for ELITE Real Estate (Doha): properties, owners, leads and the sales
pipeline, clients, viewings, deals and commission, tasks, notes and a full activity log.

**Stack:** Next.js 16 (App Router, Server Components & Server Actions) · TypeScript ·
Tailwind CSS 4 · shadcn/ui (Radix) · Prisma 7 · SQLite · Zod · React Hook Form · Lucide.

## Quick start

```bash
cd backend
npm install                 # also runs `prisma generate`
cp .env.example .env        # then set SESSION_SECRET (openssl rand -base64 32)
npx prisma migrate dev      # creates ./dev.db and applies migrations
npx prisma db seed          # realistic Doha demo data (wipes CRM tables first)
npm run dev                 # http://localhost:3001/login
```

`DATABASE_URL` defaults to `file:./dev.db`, so `npm install` and the Prisma commands also work
before `.env` exists. `SESSION_SECRET` has a development-only fallback; production refuses to
start without it.

Production: `npm run build && npm start` (apply migrations with `npm run db:deploy`).

The CRM runs on **port 3001** so it never clashes with the public website in `frontend/`
(port 3000). The website's `/login` page is a different system: use
http://localhost:3001/login for the CRM.

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
| `npm test` | Service test-suite (RBAC, validation, commission, side effects) on a throwaway `test.db` |
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
| `TZ` | Optional. Dates are always shown and parsed in `Asia/Qatar`. |

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
- **Tasks** — related to leads, clients, properties or deals; overdue highlighting.
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
    app/api/         search, lookup (async pickers), uploads (authenticated file serving)
    actions/         Server Actions — thin: validate (Zod) → call a service
    services/        business logic + database access (Prisma), RBAC scoping, activity logging
    schemas/         Zod schemas shared by forms (client) and actions (server)
    lib/             auth/session, permissions, errors, formatting, action wrapper, db client
    components/ui/   shadcn/ui primitives
    components/…     layout, shared building blocks, feature components
    hooks/ types/
  tests/             service test-suite
```

- **Auth** — bcrypt (12 rounds) passwords; random session token in an httpOnly, SameSite=Lax
  cookie; only an HMAC of the token is stored. Sessions slide for 7 days and are revoked on
  password change, deactivation or role change. Login is rate-limited and uses constant-time
  failure paths. `proxy.ts` does an optimistic redirect; the real check runs in the CRM layout
  and in **every** Server Action / Route Handler.
- **Roles** — `ADMIN` (everything, settings, all users), `MANAGER` (whole team's data,
  assignments, deletions, manages agents), `AGENT` (own leads/clients/viewings/deals/tasks,
  reads the shared inventory, edits own listings; owner contacts hidden on others' listings).
  Enforced in the service layer via `scope.*` query filters and permission checks.
- **Errors** — `authedAction` wraps every mutation: auth → Zod validation → service →
  revalidation. Prisma/unknown errors are logged server-side and returned as safe messages;
  field errors map back onto the form.
- **Dates** — stored in UTC; displayed and entered in Asia/Qatar regardless of server or
  browser time zone.

### Data model

`User` · `Session` · `Owner` · `Property` · `PropertyImage` · `PropertyInterest`
(lead/client ↔ property) · `Lead` · `Client` · `Viewing` · `Deal` · `Task` · `Note` ·
`Activity` · `Settings` · `Counter` (ELT-/DL- references).

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
- No e-mail delivery yet, so there is no self-service password reset: an admin or manager
  resets passwords from **Users**.
- The seed uses Unsplash photo URLs; they need internet access to display.

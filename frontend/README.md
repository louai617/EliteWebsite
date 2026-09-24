# ELITE Real Estate — Website & CRM

Next.js 16 (App Router) app containing the public website (en/ar) and the CRM
dashboard, backed by MongoDB Atlas through Mongoose. All database access is
server-side (route handlers under `src/app/api`); the browser never sees
database credentials.

## Quick start

```bash
cd frontend
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run seed                 # indexes, default settings, first admin, launch listings
npm run dev                  # http://localhost:3000
```

Sign in at `/en/login` with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
Staff land on `/en/dashboard`; website customers on `/en/account`.

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run seed` | Idempotent: syncs indexes, creates default settings, the first admin, broker profiles and the 4 original website listings. Never creates fake leads or statistics. |
| `npm run db:indexes` | Only syncs indexes (production runs with `autoIndex` off) |

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | yes | Atlas `mongodb+srv://…` string. Server-only. |
| `MONGODB_DB` | no | Database name (default `elite_crm`, or the one in the URI). |
| `AUTH_SECRET` | yes | ≥ 32 random chars, signs session cookies. `openssl rand -base64 48` |
| `NEXT_PUBLIC_SITE_URL` | yes in prod | Public URL, e.g. `https://elitere.qa` (metadata + reset links). |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | seed only | First admin account. Can be removed after seeding. |

`.env*` files are git-ignored (except `.env.example`).

## Roles & permissions

| Role | Access |
| --- | --- |
| **admin** | Everything, including settings, users and per-user permission overrides |
| **manager** | All leads/clients/properties/viewings/deals/tasks, manages brokers & staff, reports |
| **broker** | Their own leads, clients, viewings, deals and tasks; reads the whole property inventory, edits own listings |
| **staff** | Read-only CRM access, creates walk-in leads, own tasks |
| **user** | Website customer: saved properties, own enquiries & viewings |

Permissions are `resource.action` pairs (`leads.read_all`, `properties.update`…).
Role defaults live in `src/lib/shared/permissions.ts`; admins can grant or
revoke individual permissions per user from Dashboard → Users.

## Architecture

```
src/
  app/api/…            REST route handlers (auth, leads, clients, properties,
                       viewings, deals, tasks, users, settings, dashboard/stats,
                       public/leads, account/…)
  lib/server/          server-only: db connection, models, auth, services
  lib/validation/      zod schemas shared by the API and forms
  lib/shared/          constants, permission model, API types
  store/               Zustand stores (auth, settings, one per CRM collection)
  components/dashboard dashboard UI kit, forms, charts
  proxy.ts             locale routing + dashboard/account route protection
```

Collections: `users`, `leads`, `clients`, `properties`, `viewings`, `deals`,
`tasks`, `settings` (configurable statuses/sources/locations/types + AI config),
`counters` (reference numbers). Related records use ObjectId references.

API responses: `{ success: true, data, meta? }` or
`{ success: false, message, error: { code, details? } }`. Lists support
`?page=&limit=` (max 100), `q=` search, filters and `sort=` (`-field` for desc).

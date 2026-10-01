# Setup guide

Two apps run side by side. Start the **backend first**.

| App | Folder | URL | What |
| --- | --- | --- | --- |
| CRM + API | `backend/` | http://localhost:3002 | Staff CRM, REST API, database |
| Website + client portal | `frontend/` | http://localhost:3001 | Public site, client portal |

## 1. Requirements

- **Node.js 20.19 or newer** (22 LTS recommended). Check with `node -v`.
- Git.
- No database server to install: the CRM uses a SQLite file (`backend/dev.db`).

## 2. Get the code

```bash
git fetch origin
git checkout claude/beautiful-mccarthy-utdoix
git pull origin claude/beautiful-mccarthy-utdoix
```

## 3. Backend (CRM + API), terminal 1

```bash
cd backend
npm install
cp .env.example .env          # Windows: copy .env.example .env
```

Open `backend/.env` and set `SESSION_SECRET` to a long random string. To generate one:
`openssl rand -base64 32`, or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

**Fresh install** (no `backend/dev.db` yet):

```bash
npx prisma migrate dev        # creates dev.db with all tables
npx prisma db seed            # demo data: users, properties, leads, 3 weeks of activity
npm run dev                   # http://localhost:3002
```

**Already had the CRM running before this update** (you have a `backend/dev.db`):

```bash
npm run db:backup             # safety copy in backend/backups/
npx prisma migrate deploy     # adds the new tables/columns, keeps your data
npx prisma db seed            # optional: reloads demo data (this WIPES the CRM tables)
npm run dev
```

Run the seed if you want the demo logins below (including the client account) and the
sample history. Skip it if you have entered data you want to keep.

## 4. Frontend (website + client portal), terminal 2

```bash
cd frontend
npm install
cp .env.example .env.local    # Windows: copy .env.example .env.local
npm run dev                   # http://localhost:3001
```

The defaults in `.env.local` already point at the backend (`http://localhost:3002/api`).

## 5. Log in

| Who | Where | E-mail | Password |
| --- | --- | --- | --- |
| Admin | http://localhost:3002/login | admin@elite.qa | `Admin@2026` |
| Manager | http://localhost:3002/login | fatima@elite.qa or james@elite.qa | `Elite@2026` |
| Agent | http://localhost:3002/login | omar@elite.qa (also aisha, rohan, layla, youssef) | `Elite@2026` |
| Client | http://localhost:3001/en/login | client@elite.qa | `Client@2026` |

Staff who log in on the website are sent to the CRM automatically; a client who opens the
CRM is sent to their portal. These are development accounts — change them before real use.

## 6. What to try

**As admin or manager (CRM, :3002)**
- **Properties** in the sidebar → Residential / Commercial → Company / Private.
- **Tasks → Team tasks**: workload per agent; open any task to reassign it, add notes and see its history.
- **Tasks → Daily tasks**: recurring tasks at the bottom ("Make 20 calls" …); add your own.
- **Reports**: Today / Yesterday / This week / This month / Custom range.
- **Performance**: leaderboard, per-agent page, and "How the score works" (admin can change weights).
- **Imports**: upload `backend/samples/property-finder.sample.json` or `qatar-living.sample.json`. Keep "Dry run" ticked to preview, untick it to import.
- **Clients → open a client → Client portal** card: give that client a portal login.

**As an agent (omar@elite.qa)**
- Dashboard → "Today's work" counters.
- **Log activity** (top of My tasks, or New → Logged activity): log a call and watch the "Make 20 calls" daily task progress.
- **Reports** → "My report for today": write and submit the end-of-day summary.

**As a client (website, :3001)**
- Log in as client@elite.qa, or register a new account at http://localhost:3001/en/register.
- Browse Properties, Enquiries (send a request — it appears in the CRM as a lead), Tasks, Reports, Activity, My data, Account.

## 7. Useful commands (in `backend/`)

| Command | What it does |
| --- | --- |
| `npm test` | Runs all service tests on a separate test database (your data is not touched) |
| `npm run db:backup` | Copies the database to `backend/backups/` |
| `npm run cron:daily` | Runs the end-of-day rollover by hand |
| `npm run db:studio` | Opens a database browser |

The daily reset runs by itself while `npm run dev` is running: after midnight Qatar time it
freezes the previous day's reports and creates the new day's daily tasks. Nothing is deleted.

## 8. Optional settings (`backend/.env`)

- **Property Finder / Qatar Living feeds:** `PROPERTY_FINDER_FEED_URL`, `PROPERTY_FINDER_API_KEY`,
  `QATAR_LIVING_FEED_URL`, `QATAR_LIVING_API_KEY`. Leave empty to use file uploads only.
  A "Fetch from feed" button appears on the Imports page once a URL is set.
- **External cron instead of the built-in scheduler:** set `SCHEDULER_ENABLED=false` and
  `CRON_SECRET=<random>`, then call `POST /api/cron/daily-rollover` with
  `Authorization: Bearer <CRON_SECRET>` a few minutes after midnight Qatar time.

Every variable is explained in `backend/.env.example` and `frontend/.env.example`.

## 9. Troubleshooting

| Problem | Fix |
| --- | --- |
| "Invalid email or password" with the demo logins | Run `npx prisma db seed` in `backend/` (creates the accounts). Use the CRM URL for staff and the website URL for the client. |
| "This is a client account…" on the CRM login | Clients log in on http://localhost:3001/en/login. |
| Website says it can't reach the server | Start the backend first and check `NEXT_PUBLIC_API_URL` in `frontend/.env.local`. Restart `npm run dev` after editing `.env.local`. |
| `Port 3001/3002 is already in use` | Stop the other process (an older `npm run dev`) or restart the terminal. |
| `PrismaConfigEnvError` / missing env during install | Make sure `backend/.env` exists (`cp .env.example .env`), then `npm install` again. |
| Seed fails with a table/column error | Run `npx prisma migrate deploy` (or `npx prisma migrate dev`) first, then the seed. |
| Property photos don't show | The demo photos come from images.unsplash.com and need an internet connection. |
| Want a completely clean start | In `backend/`: `npm run db:reset` (drops, re-migrates and re-seeds — wipes all data). |

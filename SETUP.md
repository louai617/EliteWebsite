# Setup guide

Two portals run side by side and share one database. Start the **agent app first**.

| Portal | Folder | Local | Production | Who |
| --- | --- | --- | --- | --- |
| Agent app (CRM + API) | `backend/` | http://localhost:3002 | https://app.eliterealestate.qa | Agents, managers, admin |
| Website + client dashboard | `frontend/` | http://localhost:3001 | https://eliterealestate.qa | Visitors and clients |

### How the two portals connect

- **One source of truth.** Every property lives in the agent app's database. The website has
  no listings of its own: it reads them from the agent app (`/api/public/properties`).
- **Agent posts → website shows it.** A property appears on the website when it is
  *Available* or *Reserved* and **Show on website** is on (property form → *Website* section).
  Edits, price changes, photos, *Sold*/*Rented* and unpublishing show up on the website within
  a couple of seconds (instant refresh, see step 4), or within 60 s at most.
- **Client acts → agent sees it.** Viewings booked on the website land in the agent's
  **Viewings** (badge *Website · confirm*) with a high-priority *Confirm website booking*
  task. Confirming it in the agent app shows *Confirmed* in the client's dashboard. Saved
  homes, preferences, enquiries and cancellations appear on the client's page in the agent app.

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
npm run import:website-listings   # copies the 4 listings that used to be hard-coded on the website
npx prisma db seed            # optional: reloads demo data (this WIPES the CRM tables)
npm run dev
```

`import:website-listings` is safe to run more than once: listings that already exist (same
reference, e.g. `ELT-00123`) are skipped. The seed runs it automatically.

Run the seed if you want the demo logins below (including the client account) and the
sample history. Skip it if you have entered data you want to keep.

The October update's migration (`lead_rules_documents_contracts`) keeps every record and maps
the old deal statuses: *Negotiation / Contract pending / Contract signed* → **Pending contract**,
*Closed won* → **Closed**, *Closed lost* → **Cancelled**. The 24-hour clock for existing leads
starts when you run the migration, so nothing is moved to the admin straight away.

## 4. Frontend (website + client portal), terminal 2

```bash
cd frontend
npm install
cp .env.example .env.local    # Windows: copy .env.example .env.local
npm run dev                   # http://localhost:3001
```

The defaults in `.env.local` already point at the agent app (`http://localhost:3002/api`).

**Instant website refresh (recommended).** Put the same random value in both files, then
restart both apps:

```bash
openssl rand -base64 32       # or: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

- `backend/.env` → `WEBSITE_REVALIDATE_SECRET="<value>"`
- `frontend/.env.local` → `REVALIDATE_SECRET=<value>`

Without it everything still works; the website just picks up agent changes within 60 seconds.

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

**Agent posts, website shows it (:3002 → :3001)**
- **Properties → New property**: fill it in, keep **Show on website** on in the *Website*
  section (also: Exclusive, Verified, Arabic title, completion, payment plan, nearby places).
  Save, then open http://localhost:3001/en/properties — it is there.
- Change its price, untick **Show on website**, or mark it *Sold*: the website follows.
- **Videos, tours & floor plans** card on a property: paste a YouTube / Vimeo link or upload a
  video (MP4, MOV, WebM up to 200 MB), add a 360° tour (Matterport, Kuula or any link), upload
  floor plans (image or PDF) and a PDF brochure. The website shows a *Media* section with
  players, "Watch video" / "360° tour" buttons on the gallery and badges on listing cards.
- The property page in the agent app shows *Live on website* with a link to the public page;
  the properties table has a *Website* column and filter.

**Lead rules (agent app)**
- Open a lead in *Viewing* and try to move it to *Negotiation*: you must **attach the signed
  viewing form** (PDF or photo) or **request a pass** with a reason. An agent's pass request
  goes to the admin (task + Approve / Reject on the lead); a manager's is approved at once.
- **Mark as won** needs the **booking form** and the **proof of payment** (attach them in the
  dialog or the lead's *Documents*). It opens the deal as **Pending contract**, reserves the
  property and gives the agent a "Prepare the contract" task.
- **Mark as lost** needs a reason (pick one or write your own).
- A lead still **New** 24 hours after it was given to an agent moves to the admin automatically
  (Settings → *Move untouched new leads after* / *Moved leads go to*). Admins and managers can
  move many leads at once with **Leads → Reassign leads**.

**Deals & contracts**
- Deals have three statuses: **Pending contract → Closed**, or **Cancelled** (with a reason).
  Only managers close or cancel. **Closing turns the lead into a client** (documents included)
  and creates a task to add the client's QID / passport on the client page.
- On a deal, **Generate contract**: choose the template, fill the few fields it asks for, and
  print it or *Save as PDF*. Admins edit the drafts under **Contract templates** (sidebar):
  text with `{{placeholders}}`, fields for agents, live preview. Two starting drafts (sale,
  tenancy) are created on first use — have them reviewed by your legal adviser.
- **Clients → a client → Documents**: QID, passport, visa, CR, signed contract… with numbers
  and expiry dates. Files are private: only staff who can see the record (and the client, for
  their own file) can open them.

**Reservations & payments**
- Admin: **Settings → Reservations & payments** — Fawran alias, bank, IBAN, deposit rules.
- Client on the website: open an *Available* property → **Reserve this home** → choose
  **Fawran / bank transfer** (card payments show *Coming soon*) → bank details with copy
  buttons → **Upload the payment receipt**. Agent app → **Reservations** → *Confirm payment*:
  the home becomes *Reserved* and the client is e-mailed. Unpaid reservations are released
  after the hold time (48 h by default).

**E-mail & password reset**
- **Forgot password?** on both sign-in pages sends a 6-digit code (valid 10 minutes, 5 tries),
  then the person sets a new password and every other device is signed out.
- Without SMTP settings, e-mails are saved to `backend/storage/outbox/` — open the `.html`
  files in a browser to see them (and the code). Settings → *E-mail* → **Send me a test e-mail**.

**As an agent (omar@elite.qa)**
- Dashboard → "Today's work" counters.
- **Log activity** (top of My tasks, or New → Logged activity): log a call and watch the "Make 20 calls" daily task progress.
- **Reports** → "My report for today": write and submit the end-of-day summary.

**As a client (website, :3001)**
- Log in as client@elite.qa, or register a new account at http://localhost:3001/en/register.
- Open any property → **Book a viewing**: pick a day and a free time (the agent's calendar is
  checked) → *Add to calendar*. Then in the agent app (omar@elite.qa or admin) open
  **Viewings → list → "Website bookings to confirm"** and choose ⋯ → *Confirm*; the client's
  dashboard switches to *Confirmed*.
- Tap the ♥ on listings to save them. **Dashboard**:
  - **Overview**: your journey (Joined → Enquiry → Viewing → Offer → Contract → Keys), next
    viewing, your agent, price-drop alerts, homes picked for you.
  - **Bookings**: countdown, call/WhatsApp the agent, directions, add to calendar,
    reschedule or cancel (up to 2 hours before).
  - **Saved homes**: price changes since you saved, compare up to 3 side by side.
  - **For you** and **Preferences**: what you're looking for → matched listings. Your agent
    sees the same preferences on your client page.
  - **Documents**: upload your QID / passport; see receipts and contracts.
  - Bookings also lists **Reservations** with the payment details and receipt upload.
  - Enquiries, Tasks, Reports, Activity, Account.

## 7. Useful commands (in `backend/`)

| Command | What it does |
| --- | --- |
| `npm test` | Runs all service tests on a separate test database (your data is not touched) |
| `npm run import:website-listings` | Adds the website's original listings to the CRM (skips existing ones) |
| `npm run db:backup` | Copies the database to `backend/backups/` |
| `npm run cron:daily` | Runs the end-of-day rollover by hand |
| `npm run db:studio` | Opens a database browser |

The daily reset runs by itself while `npm run dev` is running: after midnight Qatar time it
freezes the previous day's reports and creates the new day's daily tasks. Nothing is deleted.

## 8. Optional settings (`backend/.env`)

- **Property Finder / Qatar Living feeds:** `PROPERTY_FINDER_FEED_URL`, `PROPERTY_FINDER_API_KEY`,
  `QATAR_LIVING_FEED_URL`, `QATAR_LIVING_API_KEY`. Leave empty to use file uploads only.
  A "Fetch from feed" button appears on the Imports page once a URL is set.
- **E-mail (SMTP):** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Any provider
  works (Microsoft 365, Google Workspace, Amazon SES…). Use an address on your domain, e.g.
  `no-reply@eliterealestate.qa`, and add the provider's SPF/DKIM records so mail isn't flagged.
- **External cron instead of the built-in scheduler:** set `SCHEDULER_ENABLED=false` and
  `CRON_SECRET=<random>`, then call `POST /api/cron/daily-rollover` with
  `Authorization: Bearer <CRON_SECRET>` every few minutes (it also runs the 24-hour lead rule
  and releases unpaid reservations).

Every variable is explained in `backend/.env.example` and `frontend/.env.example`.

## 9. Going live: eliterealestate.qa and app.eliterealestate.qa

Run each app with `npm run build && npm start` behind HTTPS (in `backend/`, apply migrations
first with `npm run db:deploy`). Point DNS for `eliterealestate.qa` (and `www`) to the
website and `app.eliterealestate.qa` to the agent app.

`backend/.env` (agent app)

```bash
APP_URL="https://app.eliterealestate.qa"
CLIENT_APP_URL="https://eliterealestate.qa"
CORS_ORIGINS="https://eliterealestate.qa,https://www.eliterealestate.qa"
SESSION_COOKIE_DOMAIN=".eliterealestate.qa"
SESSION_SECRET="<long random value>"
WEBSITE_REVALIDATE_SECRET="<long random value, same as the website's REVALIDATE_SECRET>"
SMTP_HOST="<your SMTP server>"
SMTP_USER="<user>"
SMTP_PASS="<password>"
MAIL_FROM="ELITE Real Estate <no-reply@eliterealestate.qa>"
```

`frontend/.env.local` (website). `NEXT_PUBLIC_` values are baked in at build time, so rebuild
after changing them.

```bash
NEXT_PUBLIC_API_URL=https://app.eliterealestate.qa/api
NEXT_PUBLIC_CRM_URL=https://app.eliterealestate.qa
NEXT_PUBLIC_SITE_URL=https://eliterealestate.qa
REVALIDATE_SECRET=<same value as WEBSITE_REVALIDATE_SECRET>
# API_INTERNAL_URL=http://127.0.0.1:3002/api   # optional, if both run on one server
```

Both are subdomains of the same site, so one login cookie (`.eliterealestate.qa`) works on
both: a staff member who signs in on the website is sent to the agent app, a client who opens
the agent app is sent to their dashboard. Secrets stay in the agent app's `.env`; the
website's only secret, `REVALIDATE_SECRET`, is server-only and never reaches the browser.

## 10. Troubleshooting

| Problem | Fix |
| --- | --- |
| "Invalid email or password" with the demo logins | Run `npx prisma db seed` in `backend/` (creates the accounts). Use the CRM URL for staff and the website URL for the client. |
| "This is a client account…" on the CRM login | Clients log in on http://localhost:3001/en/login. |
| Website says it can't reach the server | Start the backend first and check `NEXT_PUBLIC_API_URL` in `frontend/.env.local`. Restart `npm run dev` after editing `.env.local`. |
| `Port 3001/3002 is already in use` | Stop the other process (an older `npm run dev`) or restart the terminal. |
| `PrismaConfigEnvError` / missing env during install | Make sure `backend/.env` exists (`cp .env.example .env`), then `npm install` again. |
| Seed fails with a table/column error | Run `npx prisma migrate deploy` (or `npx prisma migrate dev`) first, then the seed. |
| No password-reset e-mail arrives | Set `SMTP_*` in `backend/.env` (see §8). Locally, open the newest file in `backend/storage/outbox/`. Settings → E-mail shows each attempt. |
| "Attach the viewing form first" | Upload the signed viewing form on the lead (Documents or Stage paperwork), or request a pass. |
| "Reserve this home" says reservations aren't open | Fill in the IBAN or Fawran alias under Settings → Reservations & payments. |
| A big video upload fails | Videos are up to 200 MB (MP4, MOV, WebM). For longer films upload to YouTube or Vimeo and paste the link. Behind a reverse proxy (nginx), allow large bodies on `/api/media-upload/`, e.g. `client_max_body_size 210m;`. |
| Property photos don't show | The demo photos come from images.unsplash.com and need an internet connection. |
| Website shows "No properties" | Start the agent app first, check that properties have **Show on website** on and are *Available*/*Reserved*. |
| Agent changes take up to a minute to appear | Set the same `WEBSITE_REVALIDATE_SECRET` / `REVALIDATE_SECRET` in both env files (step 4) and restart both apps. |
| "Book a viewing" shows no times | Viewings are 09:00–20:00 Qatar time (Fridays from 14:00), at least 2 hours ahead, up to 30 days ahead; taken slots are hidden. |
| Want a completely clean start | In `backend/`: `npm run db:reset` (drops, re-migrates and re-seeds — wipes all data). |

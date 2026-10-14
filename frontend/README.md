# ELITE Real Estate — website & client portal

Next.js 16 (App Router) · next-intl (English / Arabic) · Tailwind CSS · React Hook Form + Zod.
Runs on **http://localhost:3001** and talks to the CRM backend's REST API
(`backend/`, http://localhost:3002/api — in production the agent app at
https://app.eliterealestate.qa). This app never touches the database. Its only secret,
`REVALIDATE_SECRET`, is server-side.

```bash
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:3002/api …
npm run dev                    # http://localhost:3001  (start the backend first)
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3002/api` | Backend REST API |
| `NEXT_PUBLIC_CRM_URL` | API origin | Staff CRM (staff are redirected there after login) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical URL for SEO metadata |
| `NEXT_PUBLIC_BUSINESS_TIMEZONE` | `Asia/Qatar` | Time zone for dates in the portal |
| `REVALIDATE_SECRET` | — | Server-only. Same value as the agent app's `WEBSITE_REVALIDATE_SECRET`; lets it refresh listings instantly |
| `API_INTERNAL_URL` | `NEXT_PUBLIC_API_URL` | Server-only. Where the server fetches listings from (e.g. an internal address) |

## How it connects

- `src/lib/api.ts` — the single API client: `fetch` with `credentials: "include"` (the
  backend's httpOnly session cookie), typed responses (`src/lib/api-types.ts`) and an
  `ApiError` carrying the backend's message and field errors. No tokens in localStorage.
- `src/lib/AuthContext.tsx` — session state from `GET /auth/me`; login / register / logout.
  Roles shown here only drive navigation — the backend enforces every permission.
- Website forms (property enquiry, chat assistant) post to `POST /public/leads`, which
  creates a lead and a response task in the CRM. "Forgot password" opens a task for the team.

## Listings come from the agent app

- `src/lib/listings.ts` (server) fetches `GET /public/properties` and
  `GET /public/properties/:ref`, cached with the `listings` tag for 60 s. Home, `/properties`
  (filters, sorting and pages in the URL) and `/properties/[ref]` render from it; there is no
  static listing data in this app any more.
- `POST /api/revalidate` (Bearer `REVALIDATE_SECRET`, constant-time compare) is called by the
  agent app whenever a property changes and expires the `listings` tag immediately.
- If the agent app is unreachable the pages show a friendly error/empty state instead of
  crashing, and recover on the next request.

## Client dashboard (`/[locale]/dashboard`)

- **Overview** — journey tracker (Joined → Enquiry → Viewing booked → Viewed → Offer →
  Contract → Keys, from real CRM records), next viewing with countdown, assigned agent,
  price-drop alert, "Homes for you" preview, counters.
- **Bookings** — `BookViewing` on every property page picks a free 45-minute slot (agent and
  client calendars checked). Upcoming bookings show status (awaiting confirmation / confirmed),
  agent call and WhatsApp, directions, `.ics` add-to-calendar, reschedule and cancel.
- **Saved homes** — the ♥ on cards and property pages (`SavedHomesContext`); price change
  since saving, "no longer available" flag, side-by-side compare of up to 3.
- **For you / Preferences** — purpose, types, areas, bedrooms, budget → scored matches with
  reasons; the agent sees the same preferences in the CRM.
- **Reservations** — "Reserve this home" on available listings: deposit, Fawran / bank transfer
  (card payments shown as "coming soon"), bank details with copy buttons, receipt upload. The
  Bookings page tracks Reserved → Deposit paid → Confirmed.
- **Documents** — the client uploads QID / passport / receipts (PDF or photo) and sees contracts
  and receipts from their agent; files open from the agent app after a permission check.
- **Forgot password** — e-mail → 6-digit code → new password (`/[locale]/forgot-password`).

### Other portal pages

For CLIENT accounts (self-registered on `/register`, or created by a manager from the client's
page in the CRM). Alongside the pages above: **Enquiries** (status + new request), **Tasks** shared by
the agent, **Reports** (viewings and deals), **Activity**, **My data** (JSON export) and
**Account** (contact details, password). Every request is scoped by the backend to the signed-in
client. The old static `/dashboard/admin` pages now redirect to the CRM.

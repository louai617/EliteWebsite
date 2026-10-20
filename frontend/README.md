# ELITE Real Estate — website

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
| `NEXT_PUBLIC_CRM_URL` | API origin | Agent app; the **Agent portal** button opens its `/login` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3001` | Canonical URL for SEO metadata |
| `NEXT_PUBLIC_BUSINESS_TIMEZONE` | `Asia/Qatar` | Time zone for viewing times and payment deadlines |
| `REVALIDATE_SECRET` | — | Server-only. Same value as the agent app's `WEBSITE_REVALIDATE_SECRET`; lets it refresh listings instantly |
| `API_INTERNAL_URL` | `NEXT_PUBLIC_API_URL` | Server-only. Where the server fetches listings from (e.g. an internal address) |

## How it connects

The website has **no visitor accounts** (no sign-up, login or client dashboard). The
**Agent portal** button in the header opens the agent app's sign-in page, where agents and staff
use their CRM accounts.

- `src/lib/api.ts` — the single API client for the public endpoints: `fetch` without cookies
  (`credentials: "omit"`), typed responses (`src/lib/api-types.ts`) and an `ApiError` carrying
  the backend's message and field errors.
- Website forms (property enquiry, chat assistant) post to `POST /public/leads`, which
  creates a lead and a response task in the CRM.
- Old links redirect (`src/proxy.ts`): `/login` and `/forgot-password` → the agent app,
  `/dashboard/saved` → `/saved`, `/register` and `/dashboard/*` → the home page.

## Listings come from the agent app

- `src/lib/listings.ts` (server) fetches `GET /public/properties` and
  `GET /public/properties/:ref`, cached with the `listings` tag for 60 s. Home, `/properties`
  (filters, sorting and pages in the URL) and `/properties/[ref]` render from it; there is no
  static listing data in this app any more.
- Photos are served through `next/image` (AVIF, then WebP, sized per screen; optimized copies
  cached for a day) with the blurred previews from the agent app (`cover_blur`,
  `image_blurs`) as placeholders while they load. In production the agent app must be on a
  public address (Next refuses to optimize images from private IPs such as `localhost`).
- Listing photos arrive already watermarked (the clean originals never leave the agent app) and
  are never resized above 1920 px (`images.deviceSizes`). Cards, the gallery and the lightbox
  turn off right-click, dragging and the iPhone long-press menu (`lib/protect-photo.ts`,
  `.protected-photo` in `globals.css`). That stops casual saving only — screenshots and the
  network tab can't be blocked by any website; the watermark is the real protection.
- `POST /api/revalidate` (Bearer `REVALIDATE_SECRET`, constant-time compare) is called by the
  agent app whenever a property changes and expires the `listings` tag immediately.
- If the agent app is unreachable the pages show a friendly error/empty state instead of
  crashing, and recover on the next request.

## Booking, reserving and saving — no account needed

- **Book a viewing** (`BookViewing` on every property page) — pick a free 45-minute slot (the
  agent's calendar is checked) and leave name, mobile and e-mail. `POST /public/viewings`
  creates a viewing on a WEBSITE lead for the listing's agent with a "confirm" task; the
  visitor gets an e-mail now and another when the agent confirms, plus an `.ics` file and
  directions on screen.
- **Reserve this home** (`ReserveHome`) — deposit, Fawran / bank transfer (card shown as
  "coming soon") and the visitor's details. `POST /public/reservations` returns a private link
  token; the visitor is taken to **`/[locale]/reservation/[token]`** (also e-mailed), which
  shows the status, bank details with copy buttons, the payer details and the **receipt upload**,
  and lets them cancel before paying. The page is `noindex` and sends no referrer, so the link
  isn't leaked. Agents confirm the payment in the CRM's Reservations page.
- **Saved homes** — the ♥ on cards and property pages stores the listing in the visitor's own
  browser (`src/lib/saved-homes.ts`, localStorage, synced across tabs). **`/[locale]/saved`**
  lists them (via `GET /public/properties?refs=…`), flags homes no longer available and compares
  up to 3 side by side. Nothing is sent to the server.

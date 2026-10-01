# ELITE Real Estate — website & client portal

Next.js 16 (App Router) · next-intl (English / Arabic) · Tailwind CSS · React Hook Form + Zod.
Runs on **http://localhost:3001** and talks to the CRM backend's REST API
(`backend/`, http://localhost:3002/api). This app never touches the database and holds no
secrets: only public values live in its environment.

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

## How it connects

- `src/lib/api.ts` — the single API client: `fetch` with `credentials: "include"` (the
  backend's httpOnly session cookie), typed responses (`src/lib/api-types.ts`) and an
  `ApiError` carrying the backend's message and field errors. No tokens in localStorage.
- `src/lib/AuthContext.tsx` — session state from `GET /auth/me`; login / register / logout.
  Roles shown here only drive navigation — the backend enforces every permission.
- Website forms (property enquiry, chat assistant) post to `POST /public/leads`, which
  creates a lead and a response task in the CRM. "Forgot password" opens a task for the team.

## Client portal (`/[locale]/dashboard`)

For CLIENT accounts (self-registered on `/register`, or created by a manager from the client's
page in the CRM): overview with the assigned agent and upcoming viewings, **Properties**
(shortlist, viewed, under contract), **Enquiries** (status + new request), **Tasks** shared by
the agent, **Reports** (viewings and deals), **Activity**, **My data** (JSON export) and
**Account** (contact details, password). Every request is scoped by the backend to the signed-in
client. The old static `/dashboard/admin` pages now redirect to the CRM.

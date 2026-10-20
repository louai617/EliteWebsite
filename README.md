# ELITE Real Estate

Two portals, one database:

| Folder | Local | Production | What it is |
| --- | --- | --- | --- |
| [`backend/`](backend) | **3002** | app.eliterealestate.qa | **Agent app**: CRM + REST API (`/api`), database (Prisma/SQLite), auth, roles, properties, viewings, tasks, daily reports, performance, Property Finder / Qatar Living imports, scheduler. See [`backend/README.md`](backend/README.md). |
| [`frontend/`](frontend) | **3001** | eliterealestate.qa | **Website** (English/Arabic). No visitor accounts: visitors book viewings and reserve homes by leaving their details, save homes in their browser (`/en/saved`), and agents use the **Agent portal** button to sign in to the agent app. Talks to the agent app over HTTP only — no database access. See [`frontend/README.md`](frontend/README.md). |

Every listing on the website comes from the agent app: agents post, edit, sell or unpublish a
property and the website follows within seconds. Visitors reserve homes with a Fawran / bank
transfer deposit (a private link lets them upload the receipt); agents move leads through enforced stages (viewing form, booking form +
payment proof, reasons for Lost), generate contracts from admin-edited templates, and closing a
deal turns the lead into a client. Password resets (staff) use a 6-digit e-mail code. Viewings
visitors book on the website land in the agent's calendar as a website lead with a confirm task.

```bash
# 1) Backend: CRM + API on http://localhost:3002
cd backend && npm install && cp .env.example .env    # set SESSION_SECRET
npx prisma migrate dev && npx prisma db seed && npm run dev

# 2) Frontend: website on http://localhost:3001
cd frontend && npm install && cp .env.example .env.local && npm run dev
```

| Who | Where | Login |
| --- | --- | --- |
| Admin | http://localhost:3002/login | admin@elite.qa / `Admin@2026` |

The seed starts clean: only the admin account, no listings or team. Add managers and agents
in **Users**. For a demo team with sample listings and history: `SEED_DEMO=1 npx prisma db seed`
(managers fatima@ / james@, agents omar@ … youssef@elite.qa, password `Elite@2026`). To empty
a database that has the demo data: `npm run db:clear-demo` in `backend/` (see SETUP.md).

Step-by-step instructions, production domains and troubleshooting: [`SETUP.md`](SETUP.md).

Development login (created by the seed) — change its password, e-mail and name before using real data. The
website's **Agent portal** button opens http://localhost:3002/login; only staff accounts can sign in.

# ELITE Real Estate

Two portals, one database:

| Folder | Local | Production | What it is |
| --- | --- | --- | --- |
| [`backend/`](backend) | **3002** | app.eliterealestate.qa | **Agent app**: CRM + REST API (`/api`), database (Prisma/SQLite), auth, roles, properties, viewings, tasks, daily reports, performance, Property Finder / Qatar Living imports, scheduler. See [`backend/README.md`](backend/README.md). |
| [`frontend/`](frontend) | **3001** | eliterealestate.qa | **Website** (English/Arabic) and the **client dashboard** (`/en/dashboard`: bookings, saved homes, compare, homes for you, preferences, journey). Talks to the agent app over HTTP only — no database access. See [`frontend/README.md`](frontend/README.md). |

Every listing on the website comes from the agent app: agents post, edit, sell or unpublish a
property and the website follows within seconds. Clients reserve homes with a Fawran / bank
transfer deposit; agents move leads through enforced stages (viewing form, booking form +
payment proof, reasons for Lost), generate contracts from admin-edited templates, and closing a
deal turns the lead into a client. Password resets use a 6-digit e-mail code. Viewings clients book on the website land
in the agent's calendar with a confirm task; saved homes and preferences show on the
client's page in the agent app.

```bash
# 1) Backend: CRM + API on http://localhost:3002
cd backend && npm install && cp .env.example .env    # set SESSION_SECRET
npx prisma migrate dev && npx prisma db seed && npm run dev

# 2) Frontend: website + client portal on http://localhost:3001
cd frontend && npm install && cp .env.example .env.local && npm run dev
```

| Who | Where | Login |
| --- | --- | --- |
| Admin | http://localhost:3002/login | admin@elite.qa / `Admin@2026` |
| Managers | http://localhost:3002/login | fatima@elite.qa, james@elite.qa / `Elite@2026` |
| Agents | http://localhost:3002/login | omar@ … youssef@elite.qa / `Elite@2026` |
| Client | http://localhost:3001/en/login | client@elite.qa / `Client@2026` |

Step-by-step instructions, production domains and troubleshooting: [`SETUP.md`](SETUP.md).

Development accounts only (created by the seed) — change them before using real data. Staff
who sign in on the website are sent to the CRM; clients who open the CRM are sent to their portal.

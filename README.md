# ELITE Real Estate

| Folder | Port | What it is |
| --- | --- | --- |
| [`backend/`](backend) | **3002** | Staff CRM + REST API (`/api`): database (Prisma/SQLite), auth, roles, tasks, daily reports, performance, Property Finder / Qatar Living imports, scheduler. See [`backend/README.md`](backend/README.md). |
| [`frontend/`](frontend) | **3001** | Public website (English/Arabic) and the **client portal** (`/en/dashboard`). Talks to the backend over HTTP only — no database access, no secrets. See [`frontend/README.md`](frontend/README.md). |

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

Development accounts only (created by the seed) — change them before using real data. Staff
who sign in on the website are sent to the CRM; clients who open the CRM are sent to their portal.

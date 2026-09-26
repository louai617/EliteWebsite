# ELITE Real Estate

| Folder | What it is |
| --- | --- |
| [`frontend/`](frontend) | Public website (Next.js 16, English/Arabic). |
| [`backend/`](backend) | Internal CRM: Next.js 16, Prisma and SQLite. See [`backend/README.md`](backend/README.md) for setup, dev logins and architecture. |

```bash
# CRM
cd backend && npm install && cp .env.example .env
npx prisma migrate dev && npx prisma db seed && npm run dev   # http://localhost:3001/login

# Website
cd frontend && npm install && npm run dev                       # http://localhost:3000
```

The CRM logins (in `backend/README.md`) only work at **localhost:3001**. The website's own
`/login` page talks to a separate API that is not part of this repo.

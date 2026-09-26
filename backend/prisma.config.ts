import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Falls back to the local SQLite file so `npm install` (which runs `prisma generate`)
    // works on a fresh clone before .env exists.
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
});

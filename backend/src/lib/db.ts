import "server-only";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Single Prisma client per process. In development Next.js reloads modules on every
 * change, so the instance is cached on globalThis to avoid exhausting file handles
 * (see devClient below).
 */
function createClient() {
  // Same default as prisma.config.ts and the seed: the SQLite file next to package.json.
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient>; prismaClass?: typeof PrismaClient };

/**
 * Development keeps one client across hot reloads, but replaces it when the generated client
 * itself changed (`prisma generate` after a schema change): an old instance would keep the old
 * fields and fail with "Unknown field … for select statement" until the server restarted.
 */
function devClient() {
  if (globalForPrisma.prisma && globalForPrisma.prismaClass === PrismaClient) return globalForPrisma.prisma;
  void globalForPrisma.prisma?.$disconnect().catch(() => undefined);
  const client = createClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaClass = PrismaClient;
  return client;
}

export const db = process.env.NODE_ENV === "production" ? createClient() : devClient();

export type Db = typeof db;

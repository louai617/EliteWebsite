/**
 * One-time migration for existing databases: moves the website's former hard-coded listings
 * into the CRM. Safe to run more than once (existing references are skipped).
 *
 *   npm run import:website-listings
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { importWebsiteListings } from "../prisma/website-listings";

const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }) });

importWebsiteListings(db)
  .then((r) => console.log(`Website listings: ${r.created} imported, ${r.total - r.created} already present.`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

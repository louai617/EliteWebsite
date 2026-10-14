import type { Prisma } from "@/generated/prisma/client";
import type { db } from "@/lib/db";

/** Either the root client or an interactive-transaction client. */
export type Tx = Prisma.TransactionClient | typeof db;

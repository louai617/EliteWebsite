import "server-only";
import type { Tx } from "./types";

/**
 * Atomically increments a named counter and returns a human reference such as ELT-1031.
 * Must run inside the same transaction that creates the record.
 */
export async function nextReference(tx: Tx, name: "property" | "deal", prefix: string, start = 1000) {
  const counter = await tx.counter.upsert({
    where: { name },
    create: { name, value: start + 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${counter.value}`;
}

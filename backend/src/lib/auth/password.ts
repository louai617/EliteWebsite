import "server-only";
import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

let dummyHash: Promise<string> | null = null;

/** Compare against a throwaway hash so unknown e-mails take as long as wrong passwords. */
export async function burnPasswordCheck(plain: string) {
  dummyHash ??= bcrypt.hash("elite-crm-timing-guard", ROUNDS);
  await bcrypt.compare(plain, await dummyHash);
}

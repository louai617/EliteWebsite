import 'server-only';
import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** A real hash to compare against when the email is unknown, so timing does not reveal which emails exist. */
export const DUMMY_HASH = '$2b$12$c/GgDmXadhfBgOLotuNTsOlmufm97ak5hxW0NfMnr7LlY0zi0TvVa';

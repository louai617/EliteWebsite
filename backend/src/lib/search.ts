/**
 * Text matching helpers. SQLite's LIKE is already case-insensitive for ASCII; when moving
 * to PostgreSQL add `mode: "insensitive"` here and every search picks it up.
 */
export const like = (value: string) => ({ contains: value });

/** Normalise a phone query so "+974 5512" matches "+974 5512 3456". */
export const digitsOnly = (value: string) => value.replace(/[^0-9]/g, "");

/**
 * Hides the middle of a phone number: "+974 5512 3457" → "+9745******7". Agents see this in
 * the leads pool until a manager gives them the lead (the full number never reaches them).
 */
export function maskPhone(value: string) {
  const digits = digitsOnly(value);
  const plus = value.trim().startsWith("+") ? "+" : "";
  // With a country code (974…) show it and one more digit; a local number shows only its first.
  const head = digits.length > 10 ? 4 : 1;
  if (digits.length < 6) return `${plus}${"*".repeat(Math.max(digits.length, 3))}`;
  return `${plus}${digits.slice(0, head)}${"*".repeat(digits.length - head - 1)}${digits.slice(-1)}`;
}

/** Masks any phone number written inside free text (notes, names). */
export const maskPhonesIn = (text: string) => text.replace(/\+?[0-9][0-9 ()-]{5,}[0-9]/g, (m) => (digitsOnly(m).length >= 7 ? maskPhone(m) : m));

/** "jane.doe@gmail.com" → "j•••@gmail.com" */
export function maskEmail(value: string) {
  const [user, domain] = value.split("@");
  return domain ? `${user.slice(0, 1)}•••@${domain}` : "•••";
}

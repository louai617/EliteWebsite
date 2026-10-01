/**
 * Text matching helpers. SQLite's LIKE is already case-insensitive for ASCII; when moving
 * to PostgreSQL add `mode: "insensitive"` here and every search picks it up.
 */
export const like = (value: string) => ({ contains: value });

/** Normalise a phone query so "+974 5512" matches "+974 5512 3456". */
export const digitsOnly = (value: string) => value.replace(/[^0-9]/g, "");

/** Runs once when the server starts. */
export function register() {
  // Render dates in Doha time unless the host overrides TZ.
  process.env.TZ ||= "Asia/Qatar";
}

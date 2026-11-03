/**
 * Brings every uploaded listing photo in line with the current photo pipeline:
 *   - photos uploaded before originals were kept: the current file becomes the clean original
 *     (re-encoded like a new upload: upright, no metadata/GPS, max 2560 px WebP);
 *   - the public copy is (re)made with the watermark from Settings › Photo watermark.
 * The same work also runs by itself in the background (scheduler); this runs it all at once.
 * Photos pasted as links (other websites) are left as they are.
 *
 *   npm run photos:watermark              (alias: npm run photos:optimize)
 *   npm run photos:watermark -- --dry-run (only count what would change)
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { countPendingWatermarks, refreshWatermarks } from "@/services/photo-watermark-job";

async function main() {
  const total = await countPendingWatermarks();
  if (process.argv.includes("--dry-run")) {
    console.log(`${total} photo(s) would be updated.`);
    return;
  }
  let done = 0;
  for (;;) {
    const result = await refreshWatermarks({ limit: 25 });
    done += result.done;
    if (total) process.stdout.write(`\r${done} of ${total} photo(s) updated`);
    if (!result.remaining || !result.done) break;
  }
  console.log(total ? "" : "All photos are up to date.");
  const left = await countPendingWatermarks();
  if (left) console.log(`${left} photo(s) could not be processed (file missing or unreadable).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

/**
 * Optimizes listing photos uploaded before the photo pipeline existed: each one is re-encoded
 * like a new upload (upright, metadata/GPS removed, max 2560 px WebP, 640 px thumbnail,
 * blurred preview). The new files are written and the database updated before the old file
 * is deleted, so an interruption never loses a photo. Pasted URLs (portals, CDNs) are skipped.
 *
 *   npm run photos:optimize              (all listings)
 *   npm run photos:optimize -- --dry-run (only report what would change)
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { processPhoto, removeStoredPhoto, storePhoto } from "@/services/photos";
import { PUBLIC_PREFIX, readUpload } from "@/services/storage";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const rows = await db.propertyImage.findMany({
    where: { thumbUrl: null, url: { startsWith: PUBLIC_PREFIX } },
    select: { id: true, propertyId: true, url: true },
  });
  let done = 0;
  let savedBytes = 0;
  const skipped: string[] = [];
  for (const row of rows) {
    const file = await readUpload(row.url.slice(PUBLIC_PREFIX.length).split("/"));
    if (!file) {
      skipped.push(`${row.url} (file missing)`);
      continue;
    }
    try {
      const photo = await processPhoto(file.buf);
      if (dryRun) {
        savedBytes += file.buf.length - photo.full.length;
        done++;
        continue;
      }
      const { lowRes: _lowRes, ...stored } = await storePhoto(row.propertyId, photo);
      await db.propertyImage.update({ where: { id: row.id }, data: stored });
      await removeStoredPhoto([row.url]);
      savedBytes += file.buf.length - stored.bytes;
      done++;
    } catch (error) {
      skipped.push(`${row.url} (${error instanceof Error ? error.message : "unreadable"})`);
    }
  }
  console.log(`${dryRun ? "Would optimize" : "Optimized"} ${done} of ${rows.length} photo(s), ${(savedBytes / 1024 / 1024).toFixed(1)} MB smaller.`);
  if (skipped.length) console.log(`Skipped:\n  ${skipped.join("\n  ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

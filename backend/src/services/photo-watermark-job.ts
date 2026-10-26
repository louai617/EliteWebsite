import "server-only";
import { db } from "@/lib/db";
import { currentWatermark, processPhoto, readMaster, removePhotoFiles, renderPublic, writeMaster, writePublic } from "./photos";
import { PUBLIC_PREFIX, readUpload } from "./storage";
import { notifyWebsite } from "./website-sync";

/**
 * Keeps every uploaded photo's public copy in line with the watermark settings:
 *
 *   - photos rendered with an older watermark version are re-rendered from their clean original
 *     (new file names, so browsers and the website's image cache never show the old mark);
 *   - photos uploaded before originals were kept: their current file (still clean) becomes the
 *     original first, then the watermarked copy is made.
 *
 * Runs in small batches: right after the settings are saved, every minute from the scheduler, and
 * from `npm run photos:watermark`. Photos pasted as links (other websites) are left as they are.
 */

const g = globalThis as unknown as { __eliteWatermarkRunning?: boolean };
/** Marks a photo that couldn't be processed (file missing / unreadable) so it isn't retried forever. */
const FAILED = -1;

async function pending(version: number, take: number) {
  return db.propertyImage.findMany({
    where: {
      url: { startsWith: PUBLIC_PREFIX },
      OR: [
        { masterKey: { not: null }, watermarkVersion: { not: version } },
        { masterKey: { not: null }, watermarkVersion: null },
        { masterKey: null, watermarkVersion: null },
      ],
    },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, propertyId: true, url: true, thumbUrl: true, masterKey: true, width: true, height: true },
  });
}

export async function countPendingWatermarks() {
  const { version } = await currentWatermark();
  return db.propertyImage.count({
    where: {
      url: { startsWith: PUBLIC_PREFIX },
      OR: [
        { masterKey: { not: null }, watermarkVersion: { not: version } },
        { masterKey: { not: null }, watermarkVersion: null },
        { masterKey: null, watermarkVersion: null },
      ],
    },
  });
}

/** Processes up to `limit` photos. Returns how many were updated and how many are left. */
export async function refreshWatermarks({ limit = 20 } = {}) {
  const { options, version } = await currentWatermark();
  const rows = await pending(version, limit);
  let done = 0;
  for (const row of rows) {
    try {
      let masterKey = row.masterKey;
      let master: Buffer | null = masterKey ? await readMaster(masterKey) : null;
      let width = row.width;
      let height = row.height;
      const createdMaster = !master;
      if (!master) {
        // Uploaded before originals were kept: the current (unwatermarked) file is the original.
        const file = await readUpload(row.url.slice(PUBLIC_PREFIX.length).split("/"));
        if (!file) throw new Error("file missing");
        const processed = await processPhoto(file.buf);
        master = processed.master;
        width = processed.width;
        height = processed.height;
        masterKey = await writeMaster(row.propertyId, master);
      }
      if (!master || !masterKey) throw new Error("no original");
      const copy = await writePublic(row.propertyId, await renderPublic(master, width!, height!, options));
      // Only if the photo is still the one read above (not deleted or redone by another run meanwhile).
      const { count } = await db.propertyImage.updateMany({ where: { id: row.id, url: row.url }, data: { ...copy, masterKey, width, height, watermarkVersion: version } });
      if (!count) {
        await removePhotoFiles({ ...copy, masterKey: createdMaster ? masterKey : null });
        continue;
      }
      await removePhotoFiles({ url: row.url, thumbUrl: row.thumbUrl });
      done++;
    } catch {
      await db.propertyImage.updateMany({ where: { id: row.id, masterKey: null }, data: { watermarkVersion: FAILED } }).catch(() => undefined);
      if (row.masterKey) await db.propertyImage.updateMany({ where: { id: row.id }, data: { watermarkVersion: version } }).catch(() => undefined);
    }
  }
  if (done) notifyWebsite();
  return { done, remaining: rows.length < limit ? 0 : await countPendingWatermarks() };
}

/** Works through every pending photo in the background (one run at a time per process). */
export function refreshAllWatermarksInBackground() {
  if (g.__eliteWatermarkRunning) return;
  g.__eliteWatermarkRunning = true;
  void (async () => {
    try {
      for (let i = 0; i < 10_000; i++) {
        const { done, remaining } = await refreshWatermarks({ limit: 20 });
        if (!remaining || !done) break;
      }
    } catch (error) {
      console.error("[photos] watermark refresh failed", error);
    } finally {
      g.__eliteWatermarkRunning = false;
    }
  })();
}

export const watermarkRefreshRunning = () => Boolean(g.__eliteWatermarkRunning);

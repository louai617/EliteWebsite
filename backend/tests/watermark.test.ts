/**
 * Photo watermark: the mark itself (position, size, opacity, off), clean private originals next
 * to watermarked public copies, re-rendering after a settings change, photos uploaded before
 * watermarking, the original download and its permissions.
 *   npm test   (uses a throwaway ./test.db, never the dev database)
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { toPublicError } from "@/lib/errors";
import { propertySchema } from "@/schemas/property";
import { watermarkSettingsSchema } from "@/schemas/settings";
import { countPendingWatermarks, refreshWatermarks, watermarkRefreshRunning } from "@/services/photo-watermark-job";
import { currentWatermark, readMaster, renderWatermarkPreview } from "@/services/photos";
import { createProperty, deleteProperty, getProperty, openPhotoOriginal, uploadPropertyPhoto } from "@/services/properties";
import { updateWatermarkSettings } from "@/services/settings";
import { renderWatermarked, type WatermarkOptions } from "@/services/watermark";
import type { Role } from "@/generated/prisma/enums";

let pass = 0;
let fail = 0;
function check(name: string, ok: unknown, extra?: unknown) {
  if (ok) pass++;
  else {
    fail++;
    console.log(`FAIL  ${name}`, extra ?? "");
  }
}
async function rejects(name: string, fn: () => Promise<unknown>, match?: RegExp) {
  try {
    await fn();
    check(`${name} (expected rejection)`, false);
  } catch (e) {
    const msg = toPublicError(e).message;
    check(name, !match || match.test(msg), msg);
  }
}
const actorFor = async (email: string) => (await db.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true } })) as { id: string; role: Role };
const uploadsFile = (url: string) => path.join(process.cwd(), "storage", "uploads", url.replace(/^\/api\/uploads\//, ""));
const masterFile = (key: string) => path.join(process.cwd(), "storage", "photo-masters", key);
const asFile = (buf: Buffer, name = "photo.jpg", type = "image/jpeg") => new File([new Uint8Array(buf)], name, { type });

/** A flat dark photo: any brightening comes from the white mark. */
const flat = (width: number, height: number, shade = 70) => sharp({ create: { width, height, channels: 3, background: { r: shade, g: shade, b: shade } } }).jpeg({ quality: 95 }).toBuffer();
/** A noisy photo (unique per seed, so duplicate detection doesn't trip). */
async function noisy(width: number, height: number, seed: number) {
  const raw = Buffer.alloc(width * height * 3);
  let x = seed;
  for (let i = 0; i < raw.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    raw[i] = 50 + (x % 60);
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
}
/**
 * How much `img` was lightened against the clean `ref` inside a region (fractions of the image):
 * the share of pixels made clearly brighter, and their average lift.
 */
async function lift(img: Buffer, ref: Buffer, region: { left: number; top: number; width: number; height: number }) {
  const meta = await sharp(img).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const box = { left: Math.round(region.left * W), top: Math.round(region.top * H), width: Math.round(region.width * W), height: Math.round(region.height * H) };
  const raw = (b: Buffer) => sharp(b).resize(W, H, { fit: "fill" }).extract(box).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [a, r] = await Promise.all([raw(img), raw(ref)]);
  let n = 0;
  let sum = 0;
  for (let i = 0; i < a.data.length; i += a.info.channels) {
    const d = a.data[i] - r.data[i];
    if (d > 20) {
      n++;
      sum += d;
    }
  }
  const pixels = a.info.width * a.info.height;
  return { share: n / pixels, mean: n ? sum / n : 0 };
}
/** Watermark present in the region / absent from it. */
const marked = async (img: Buffer, ref: Buffer, region: Parameters<typeof lift>[2]) => (await lift(img, ref, region)).share > 0.03;
const clean = async (img: Buffer, ref: Buffer, region: Parameters<typeof lift>[2]) => (await lift(img, ref, region)).share < 0.002;
const CENTER = { left: 0.3, top: 0.4, width: 0.4, height: 0.2 };
const BOTTOM_RIGHT = { left: 0.6, top: 0.75, width: 0.38, height: 0.23 };
const BOTTOM_LEFT = { left: 0.02, top: 0.75, width: 0.38, height: 0.23 };
const TOP_LEFT = { left: 0.02, top: 0.02, width: 0.2, height: 0.2 };
/** Share of the whole photo lightened by the mark. */
const markedShare = async (img: Buffer, ref: Buffer) => (await lift(img, ref, { left: 0, top: 0, width: 1, height: 1 })).share;

async function waitForBackground() {
  for (let i = 0; i < 600 && watermarkRefreshRunning(); i++) await new Promise((r) => setTimeout(r, 50));
}

async function main() {
  // ── The mark ──
  const base: WatermarkOptions = { enabled: true, position: "CENTER", size: 30, opacity: 45 };
  const bg = await flat(1600, 1200);
  const center = await renderWatermarked(bg, 1600, 1200, base);
  check("output is WebP", (await sharp(center).metadata()).format === "webp");
  check("centre mark sits in the middle of the photo", await marked(center, bg, CENTER), await lift(center, bg, CENTER));
  check("centre mark leaves the corners alone", (await clean(center, bg, TOP_LEFT)) && (await clean(center, bg, BOTTOM_RIGHT)));
  const corner = await renderWatermarked(bg, 1600, 1200, { ...base, position: "BOTTOM_RIGHT", size: 20 });
  check("bottom-right mark sits bottom right", (await marked(corner, bg, BOTTOM_RIGHT)) && (await clean(corner, bg, CENTER)) && (await clean(corner, bg, BOTTOM_LEFT)));
  const left = await renderWatermarked(bg, 1600, 1200, { ...base, position: "BOTTOM_LEFT", size: 20 });
  check("bottom-left mark sits bottom left", (await marked(left, bg, BOTTOM_LEFT)) && (await clean(left, bg, BOTTOM_RIGHT)));
  const bigger = await renderWatermarked(bg, 1600, 1200, { ...base, size: 55 });
  check("a bigger size covers more of the photo", (await markedShare(bigger, bg)) > (await markedShare(center, bg)) * 1.8, { small: await markedShare(center, bg), big: await markedShare(bigger, bg) });
  const faint = await renderWatermarked(bg, 1600, 1200, { ...base, opacity: 15 });
  const strong = await renderWatermarked(bg, 1600, 1200, { ...base, opacity: 85 });
  check("higher opacity is more visible", (await lift(strong, bg, CENTER)).mean > (await lift(faint, bg, CENTER)).mean + 30, [await lift(faint, bg, CENTER), await lift(strong, bg, CENTER)]);
  const off = await renderWatermarked(bg, 1600, 1200, { ...base, enabled: false });
  check("turned off: the photo is only re-encoded", (await markedShare(off, bg)) < 0.001);
  const portrait = await flat(900, 1600);
  const tall = await renderWatermarked(portrait, 900, 1600, { ...base, size: 60 });
  check("portrait photos keep their size and the mark stays inside", (await sharp(tall).metadata()).height === 1600 && (await markedShare(tall, portrait)) > 0.005);
  check("settings are validated (size 10–60, opacity 10–90)", !watermarkSettingsSchema.safeParse({ watermarkEnabled: true, watermarkPosition: "CENTER", watermarkSize: 5, watermarkOpacity: 45 }).success && !watermarkSettingsSchema.safeParse({ watermarkEnabled: true, watermarkPosition: "TOP", watermarkSize: 30, watermarkOpacity: 45 }).success);

  // ── Uploads keep a clean original and publish a watermarked copy ──
  const omar = await actorFor("omar@elite.qa");
  const aisha = await actorFor("aisha@elite.qa");
  const fatima = await actorFor("fatima@elite.qa");
  const admin = await actorFor("admin@elite.qa");
  const owner = await db.owner.findFirstOrThrow({ select: { id: true } });
  const p = await createProperty(omar, propertySchema.parse({ title: "Watermark test villa", type: "VILLA", purpose: "SALE", status: "AVAILABLE", price: "5000000", currency: "QAR", country: "Qatar", city: "Doha", area: "West Bay", bedrooms: "5", ownerId: owner.id, agentId: null, websitePublished: true }));
  const startVersion = (await currentWatermark()).version;
  const a = await uploadPropertyPhoto(omar, p.id, asFile(await flat(2000, 1500)));
  const b = await uploadPropertyPhoto(omar, p.id, asFile(await noisy(1800, 1200, 21)));
  const rowA = await db.propertyImage.findUniqueOrThrow({ where: { id: a.id } });
  check("the upload records its original and the watermark version", Boolean(rowA.masterKey) && rowA.watermarkVersion === startVersion && a.hasOriginal);
  check("the original is stored outside the public uploads folder", existsSync(masterFile(rowA.masterKey!)) && !masterFile(rowA.masterKey!).includes(`${path.sep}uploads${path.sep}`));
  const publicA = readFileSync(uploadsFile(a.url));
  const masterA = (await readMaster(rowA.masterKey!))!;
  check("the public copy carries the watermark, the original doesn't", await marked(publicA, masterA, CENTER));
  check("the thumbnail carries the watermark too", await marked(readFileSync(uploadsFile(a.thumbUrl!)), masterA, CENTER));
  check("originals keep the full size", (await sharp(masterA).metadata()).width === 2000);
  check("master keys can't climb out of their folder", (await readMaster("../uploads/" + a.url.replace(/^\/api\/uploads\//, ""))) === null && (await readMaster("../../.env")) === null);
  const detail = await getProperty(omar, p.id);
  check("the listing page knows there is an original but never sees where it is stored", detail!.images.every((i) => i.hasOriginal && !("masterKey" in i)));

  // ── Downloading the original ──
  const original = await openPhotoOriginal(omar, p.id, a.id);
  const originalMeta = original ? await sharp(original.buf).metadata() : null;
  check("the listing's agent downloads a clean JPEG original", originalMeta?.format === "jpeg" && originalMeta.width === 2000 && original!.fileName.endsWith("-photo-1.jpg"), original?.fileName);
  check("the downloaded original has no watermark", original ? await clean(original.buf, masterA, CENTER) : false);
  check("managers can download originals", Boolean(await openPhotoOriginal(fatima, p.id, a.id)));
  await rejects("other agents can't download originals", () => openPhotoOriginal(aisha, p.id, a.id), /agent and managers/);
  check("a photo of another listing isn't found under this listing", (await openPhotoOriginal(omar, "someone-else", a.id)) === null);
  const pasted = await db.propertyImage.create({ data: { propertyId: p.id, url: "https://images.unsplash.com/photo-xyz", sortOrder: 5 } });
  check("photos pasted as links have no original", (await openPhotoOriginal(omar, p.id, pasted.id)) === null);

  // ── Changing the settings re-renders every public copy ──
  await rejects("only admins can change the watermark", () => updateWatermarkSettings(omar, watermarkSettingsSchema.parse({ watermarkEnabled: true, watermarkPosition: "BOTTOM_RIGHT", watermarkSize: 20, watermarkOpacity: 60 })), /Only admins/);
  const same = await updateWatermarkSettings(admin, watermarkSettingsSchema.parse({ watermarkEnabled: true, watermarkPosition: "CENTER", watermarkSize: 30, watermarkOpacity: 45 }));
  await waitForBackground();
  check("saving unchanged settings changes nothing", !same.changed && (await currentWatermark()).version === startVersion);
  const moved = await updateWatermarkSettings(admin, watermarkSettingsSchema.parse({ watermarkEnabled: true, watermarkPosition: "BOTTOM_RIGHT", watermarkSize: 20, watermarkOpacity: 60 }));
  check("a change bumps the version", moved.changed && (await currentWatermark()).version === startVersion + 1);
  await waitForBackground();
  while ((await refreshWatermarks()).remaining) {
    /* finish anything left */
  }
  const [rowA2, rowB2] = await Promise.all([a.id, b.id].map((id) => db.propertyImage.findUniqueOrThrow({ where: { id } })));
  check("every photo was re-rendered with the new version", rowA2.watermarkVersion === startVersion + 1 && rowB2.watermarkVersion === startVersion + 1 && (await countPendingWatermarks()) === 0);
  check("re-rendered copies get new file names (no stale caches)", rowA2.url !== a.url && rowA2.thumbUrl !== a.thumbUrl && rowB2.url !== b.url);
  check("the old public files are deleted, the original is kept", !existsSync(uploadsFile(a.url)) && !existsSync(uploadsFile(a.thumbUrl!)) && existsSync(uploadsFile(rowA2.url)) && rowA2.masterKey === rowA.masterKey && existsSync(masterFile(rowA.masterKey!)));
  const publicA2 = readFileSync(uploadsFile(rowA2.url));
  check("the mark moved to the bottom right", (await marked(publicA2, masterA, BOTTOM_RIGHT)) && (await clean(publicA2, masterA, CENTER)));
  const unrelated = await db.propertyImage.findUniqueOrThrow({ where: { id: pasted.id } });
  check("photos pasted as links are left alone", unrelated.url === "https://images.unsplash.com/photo-xyz" && unrelated.masterKey === null);

  await updateWatermarkSettings(admin, watermarkSettingsSchema.parse({ watermarkEnabled: false, watermarkPosition: "BOTTOM_RIGHT", watermarkSize: 20, watermarkOpacity: 60 }));
  await waitForBackground();
  const rowA3 = await db.propertyImage.findUniqueOrThrow({ where: { id: a.id } });
  check("turning it off publishes clean copies", (await markedShare(readFileSync(uploadsFile(rowA3.url)), masterA)) < 0.001);
  await updateWatermarkSettings(admin, watermarkSettingsSchema.parse({ watermarkEnabled: true, watermarkPosition: "CENTER", watermarkSize: 30, watermarkOpacity: 45 }));
  await waitForBackground();

  // ── Photos uploaded before watermarking ──
  const legacyName = "legacy-before-watermark";
  const dir = path.join(process.cwd(), "storage", "uploads", "properties", p.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${legacyName}.webp`), await sharp(await flat(1600, 1200)).webp().toBuffer());
  const legacy = await db.propertyImage.create({ data: { propertyId: p.id, url: `/api/uploads/properties/${p.id}/${legacyName}.webp`, width: 1600, height: 1200, sortOrder: 6 } });
  const missing = await db.propertyImage.create({ data: { propertyId: p.id, url: `/api/uploads/properties/${p.id}/gone.webp`, width: 1600, height: 1200, sortOrder: 7 } });
  check("older photos count as pending", (await countPendingWatermarks()) === 2);
  await refreshWatermarks();
  const legacy2 = await db.propertyImage.findUniqueOrThrow({ where: { id: legacy.id } });
  check("an older photo's file becomes its original, and a watermarked copy is published", Boolean(legacy2.masterKey) && existsSync(masterFile(legacy2.masterKey!)) && legacy2.url !== legacy.url && !existsSync(uploadsFile(legacy.url)));
  check("the older photo is now watermarked", await marked(readFileSync(uploadsFile(legacy2.url)), (await readMaster(legacy2.masterKey!))!, CENTER));
  check("a missing file is skipped, not retried forever", (await db.propertyImage.findUniqueOrThrow({ where: { id: missing.id } })).watermarkVersion === -1 && (await countPendingWatermarks()) === 0);

  // ── Preview ──
  const preview = await renderWatermarkPreview({ enabled: true, position: "CENTER", size: 30, opacity: 45 });
  const previewMeta = await sharp(preview).metadata();
  check("the settings preview is a WebP up to 1200 px", previewMeta.format === "webp" && Math.max(previewMeta.width ?? 0, previewMeta.height ?? 0) <= 1200);

  // ── Clean-up ──
  const keys = (await db.propertyImage.findMany({ where: { propertyId: p.id, masterKey: { not: null } }, select: { masterKey: true } })).map((r) => r.masterKey!);
  await deleteProperty(fatima, p.id);
  check("deleting the listing deletes the originals too", keys.length === 3 && keys.every((k) => !existsSync(masterFile(k))));

  console.log(`watermark tests: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

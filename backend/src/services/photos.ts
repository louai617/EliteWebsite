import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { invalid } from "@/lib/errors";
import { deleteUpload, PUBLIC_PREFIX } from "./storage";
import { renderWatermarked, type WatermarkOptions } from "./watermark";

/**
 * Listing photo pipeline. Every upload is re-encoded on the server, whatever the browser sent:
 *
 *   - rotated upright from the EXIF orientation, converted to sRGB
 *   - all metadata removed (EXIF, GPS location of the owner's home, camera serials…)
 *   - longest edge capped at 2560 px, saved as WebP (≈ 250–600 KB instead of 5–12 MB)
 *
 * Two copies are kept:
 *   - the clean **original** (master) in ./storage/photo-masters/properties/<propertyId>/ — private,
 *     never served publicly; staff can download it (e.g. for portals) and every public copy is
 *     rebuilt from it;
 *   - the **public copy** with the company watermark (Settings › Photo watermark) in
 *     ./storage/uploads/properties/<propertyId>/<uuid>.webp, plus a 640 px thumbnail, served by
 *     /api/uploads/… (public only while the listing is live on the website).
 * A ~150-byte blurred preview is stored for the website. When the watermark settings change, the
 * public copies are re-rendered in the background (services/photo-watermark-job.ts).
 */

const ROOT = path.join(process.cwd(), "storage", "uploads");
const MASTER_ROOT = path.join(process.cwd(), "storage", "photo-masters");

export const PHOTO_RULES = {
  /** Largest file accepted (the browser shrinks big photos before sending them). */
  maxBytes: 10 * 1024 * 1024,
  /** Longest edge of the stored photo. */
  maxEdge: 2560,
  thumbEdge: 640,
  /** Shorter than this on the long edge is refused: too small for a listing. */
  minEdge: 480,
  /** Long edge below this is accepted but flagged as low resolution. */
  goodEdge: 1600,
  maxPhotos: 40,
} as const;

const QUALITY = { full: 82, thumb: 74, blur: 40 } as const;
/** Refuse decompression bombs: 100 megapixels is far above any phone or DSLR photo. */
const MAX_PIXELS = 100_000_000;

type InputType = "jpeg" | "png" | "webp" | "avif" | "heic";

/** Identify the file from its bytes (never from the name or the browser's type). */
function sniff(buf: Buffer): InputType | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis") return "avif";
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return "heic";
  }
  return null;
}

export interface ProcessedPhoto {
  /** Clean original: upright, no metadata, max 2560 px WebP. */
  master: Buffer;
  width: number;
  height: number;
  blurDataUrl: string;
  checksum: string;
  lowRes: boolean;
}

/** Validates and re-encodes one photo (pure: no disk access). */
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  if (input.length === 0) throw invalid("The file is empty.", { file: ["Empty file"] });
  if (input.length > PHOTO_RULES.maxBytes) throw invalid("Photos must be 10 MB or smaller.", { file: ["Max 10 MB"] });
  const type = sniff(input);
  if (type === "heic") throw invalid("HEIC photos can't be read here. On iPhone choose “Most Compatible” in Settings › Camera › Formats, or export as JPG.", { file: ["Use JPG"] });
  if (!type) throw invalid("Only JPG, PNG, WebP or AVIF photos are allowed.", { file: ["JPG, PNG, WebP or AVIF"] });

  // One decode, auto-rotated; `failOn: "error"` refuses truncated/corrupt files.
  const base = sharp(input, { failOn: "error", limitInputPixels: MAX_PIXELS, animated: false }).rotate();
  let meta: Awaited<ReturnType<typeof base.metadata>>;
  try {
    meta = await base.metadata();
  } catch {
    throw invalid("This photo is damaged or not a real image.", { file: ["Unreadable image"] });
  }
  // Orientations 5–8 swap width and height once rotated upright.
  const swap = (meta.orientation ?? 1) >= 5;
  const w = (swap ? meta.height : meta.width) ?? 0;
  const h = (swap ? meta.width : meta.height) ?? 0;
  const longEdge = Math.max(w, h);
  if (longEdge < PHOTO_RULES.minEdge) throw invalid(`This photo is too small (${w}×${h}). Use at least ${PHOTO_RULES.minEdge} px.`, { file: ["Too small"] });

  const fit = (edge: number) => ({ width: edge, height: edge, fit: "inside" as const, withoutEnlargement: true });
  try {
    const [full, blur] = await Promise.all([
      base.clone().resize(fit(PHOTO_RULES.maxEdge)).toColorspace("srgb").webp({ quality: QUALITY.full, effort: 5, smartSubsample: true }).toBuffer({ resolveWithObject: true }),
      base.clone().resize(fit(16)).toColorspace("srgb").webp({ quality: QUALITY.blur }).toBuffer(),
    ]);
    return {
      master: full.data,
      width: full.info.width,
      height: full.info.height,
      blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
      checksum: createHash("sha256").update(input).digest("hex"),
      lowRes: longEdge < PHOTO_RULES.goodEdge,
    };
  } catch {
    throw invalid("This photo could not be processed. Try exporting it again as JPG.", { file: ["Unreadable image"] });
  }
}

/** The watermark in force and its version (Settings › Photo watermark). */
export async function currentWatermark(): Promise<{ options: WatermarkOptions; version: number }> {
  const s = await db.settings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
  return {
    options: { enabled: s.watermarkEnabled, position: s.watermarkPosition, size: s.watermarkSize, opacity: s.watermarkOpacity },
    version: s.watermarkVersion,
  };
}

/** Public copy (watermarked when enabled) and its 640 px thumbnail, from a clean original. */
export async function renderPublic(master: Buffer, width: number, height: number, watermark: WatermarkOptions) {
  const full = await renderWatermarked(master, width, height, watermark, QUALITY.full);
  // From the finished, watermarked image: thumbnails carry the mark too.
  const thumb = await sharp(full).resize({ width: PHOTO_RULES.thumbEdge, height: PHOTO_RULES.thumbEdge, fit: "inside", withoutEnlargement: true }).webp({ quality: QUALITY.thumb, effort: 4 }).toBuffer();
  return { full, thumb };
}

function folderFor(propertyId: string) {
  const safe = propertyId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw invalid("Invalid property.");
  return { dir: path.join(ROOT, "properties", safe), prefix: `${PUBLIC_PREFIX}properties/${safe}/` };
}

export interface StoredPhoto {
  url: string;
  thumbUrl: string;
  masterKey: string;
  watermarkVersion: number;
  width: number;
  height: number;
  bytes: number;
  blurDataUrl: string;
  checksum: string;
  lowRes: boolean;
}

const safeId = (propertyId: string) => {
  const safe = propertyId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw invalid("Invalid property.");
  return safe;
};

/** Resolves a master key to a file path, refusing anything outside the masters folder. */
function masterPath(key: string) {
  const full = path.resolve(MASTER_ROOT, key);
  return full.startsWith(MASTER_ROOT + path.sep) ? full : null;
}

export async function writeMaster(propertyId: string, master: Buffer) {
  const key = `properties/${safeId(propertyId)}/${randomUUID()}.webp`;
  const file = masterPath(key)!;
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ file, master);
  return key;
}

export async function readMaster(key: string) {
  const file = masterPath(key);
  return file ? readFile(/*turbopackIgnore: true*/ file).catch(() => null) : null;
}

/** Writes a public copy + thumbnail under a fresh name (so caches never show an old watermark). */
export async function writePublic(propertyId: string, copy: { full: Buffer; thumb: Buffer }) {
  const { dir, prefix } = folderFor(propertyId);
  const name = randomUUID();
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  await Promise.all([
    writeFile(/*turbopackIgnore: true*/ path.join(dir, `${name}.webp`), copy.full),
    writeFile(/*turbopackIgnore: true*/ path.join(dir, `${name}-thumb.webp`), copy.thumb),
  ]);
  return { url: `${prefix}${name}.webp`, thumbUrl: `${prefix}${name}-thumb.webp`, bytes: copy.full.length };
}

/** Stores the clean original and the watermarked public copy; call `removePhotoFiles` to roll back. */
export async function storePhoto(propertyId: string, photo: ProcessedPhoto): Promise<StoredPhoto> {
  const watermark = await currentWatermark();
  const masterKey = await writeMaster(propertyId, photo.master);
  try {
    const copy = await writePublic(propertyId, await renderPublic(photo.master, photo.width, photo.height, watermark.options));
    return {
      ...copy,
      masterKey,
      watermarkVersion: watermark.version,
      width: photo.width,
      height: photo.height,
      blurDataUrl: photo.blurDataUrl,
      checksum: photo.checksum,
      lowRes: photo.lowRes,
    };
  } catch (error) {
    await removePhotoFiles({ masterKey });
    throw error;
  }
}

const PREVIEW_EDGE = 1200;

/**
 * A preview of `watermark` on the most recently uploaded photo (a plain sample picture when
 * there is none yet), for the settings page. Never stored.
 */
export async function renderWatermarkPreview(watermark: WatermarkOptions) {
  const latest = await db.propertyImage.findFirst({ where: { masterKey: { not: null } }, orderBy: { createdAt: "desc" }, select: { masterKey: true } });
  const master = latest?.masterKey ? await readMaster(latest.masterKey) : null;
  const source = master
    ? sharp(master).resize({ width: PREVIEW_EDGE, height: PREVIEW_EDGE, fit: "inside", withoutEnlargement: true })
    : sharp(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${PREVIEW_EDGE}" height="800"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb2e0"/><stop offset="0.62" stop-color="#e9d6b8"/><stop offset="0.62" stop-color="#8a7a66"/><stop offset="1" stop-color="#4a4036"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#s)"/></svg>`,
        ),
      );
  const { data, info } = await source.toColorspace("srgb").png().toBuffer({ resolveWithObject: true });
  return renderWatermarked(data, info.width, info.height, watermark, 78);
}

/** Deletes a photo's files: public copy, thumbnail and private original (missing files are fine). */
export async function removePhotoFiles(files: { url?: string | null; thumbUrl?: string | null; masterKey?: string | null }) {
  await Promise.all([files.url, files.thumbUrl].filter((u): u is string => Boolean(u)).map(deleteUpload));
  const master = files.masterKey ? masterPath(files.masterKey) : null;
  if (master) await unlink(/*turbopackIgnore: true*/ master).catch(() => undefined);
}

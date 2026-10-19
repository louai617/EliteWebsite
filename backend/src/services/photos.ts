import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { invalid } from "@/lib/errors";
import { deleteUpload, PUBLIC_PREFIX } from "./storage";

/**
 * Listing photo pipeline. Every upload is re-encoded on the server, whatever the browser sent:
 *
 *   - rotated upright from the EXIF orientation, converted to sRGB
 *   - all metadata removed (EXIF, GPS location of the owner's home, camera serials…)
 *   - longest edge capped at 2560 px, saved as WebP (≈ 250–600 KB instead of 5–12 MB)
 *   - a 640 px WebP thumbnail for CRM lists and a ~300-byte blurred preview for the website
 *
 * Files go to ./storage/uploads/properties/<propertyId>/<uuid>.webp (+ <uuid>-thumb.webp) and are
 * served by /api/uploads/… (public only while the listing is live on the website).
 */

const ROOT = path.join(process.cwd(), "storage", "uploads");

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
  full: Buffer;
  thumb: Buffer;
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
    const [full, thumb, blur] = await Promise.all([
      base.clone().resize(fit(PHOTO_RULES.maxEdge)).toColorspace("srgb").webp({ quality: QUALITY.full, effort: 5, smartSubsample: true }).toBuffer({ resolveWithObject: true }),
      base.clone().resize(fit(PHOTO_RULES.thumbEdge)).toColorspace("srgb").webp({ quality: QUALITY.thumb, effort: 4 }).toBuffer(),
      base.clone().resize(fit(16)).toColorspace("srgb").webp({ quality: QUALITY.blur }).toBuffer(),
    ]);
    return {
      full: full.data,
      thumb,
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

function folderFor(propertyId: string) {
  const safe = propertyId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw invalid("Invalid property.");
  return { dir: path.join(ROOT, "properties", safe), prefix: `${PUBLIC_PREFIX}properties/${safe}/` };
}

export interface StoredPhoto {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  bytes: number;
  blurDataUrl: string;
  checksum: string;
  lowRes: boolean;
}

/** Writes a processed photo and its thumbnail; call `removeStoredPhoto` to roll back. */
export async function storePhoto(propertyId: string, photo: ProcessedPhoto): Promise<StoredPhoto> {
  const { dir, prefix } = folderFor(propertyId);
  const name = randomUUID();
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  await Promise.all([
    writeFile(/*turbopackIgnore: true*/ path.join(dir, `${name}.webp`), photo.full),
    writeFile(/*turbopackIgnore: true*/ path.join(dir, `${name}-thumb.webp`), photo.thumb),
  ]);
  return {
    url: `${prefix}${name}.webp`,
    thumbUrl: `${prefix}${name}-thumb.webp`,
    width: photo.width,
    height: photo.height,
    bytes: photo.full.length,
    blurDataUrl: photo.blurDataUrl,
    checksum: photo.checksum,
    lowRes: photo.lowRes,
  };
}

/** Deletes an uploaded photo's files (ignores pasted URLs and files already gone). */
export async function removeStoredPhoto(urls: (string | null | undefined)[]) {
  await Promise.all(urls.filter((u): u is string => Boolean(u)).map(deleteUpload));
}

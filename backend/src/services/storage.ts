import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { invalid } from "@/lib/errors";

/**
 * Local file storage for property photos. Files live in ./storage/uploads (outside
 * /public so they are served through an authenticated route and work in production
 * builds). Swap this module for S3/R2/Cloudinary later without touching callers.
 */
const ROOT = path.join(process.cwd(), "storage", "uploads");
export const PUBLIC_PREFIX = "/api/uploads/";

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(4, 12).toString("ascii").startsWith("ftypavi")) return "image/avif";
  return null;
}

export async function saveImage(folder: string, file: File) {
  if (file.size === 0) throw invalid("The file is empty.");
  if (file.size > MAX_IMAGE_BYTES) throw invalid("Images must be 8 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  // Trust the bytes, not the browser-provided type.
  const type = sniff(buf);
  if (!type || !ALLOWED_IMAGE_TYPES[type]) throw invalid("Only JPG, PNG, WebP or AVIF images are allowed.");
  // Sanitise each segment separately so "properties/<id>" stays two folders.
  const safeFolder = folder
    .split("/")
    .map((segment) => segment.replace(/[^a-zA-Z0-9_-]/g, ""))
    .filter(Boolean)
    .join("/");
  if (!safeFolder) throw invalid("Invalid upload folder.");
  const name = `${randomUUID()}.${ALLOWED_IMAGE_TYPES[type]}`;
  const dir = path.join(ROOT, safeFolder);
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ path.join(dir, name), buf);
  return `${PUBLIC_PREFIX}${safeFolder}/${name}`;
}

/** Resolves a public upload URL to a file path, refusing anything outside ROOT. */
function resolve(url: string) {
  if (!url.startsWith(PUBLIC_PREFIX)) return null;
  const rel = url.slice(PUBLIC_PREFIX.length);
  const full = path.resolve(ROOT, rel);
  return full.startsWith(ROOT + path.sep) ? full : null;
}

export async function readUpload(segments: string[]) {
  const full = resolve(PUBLIC_PREFIX + segments.join("/"));
  if (!full) return null;
  try {
    const buf = await readFile(/*turbopackIgnore: true*/ full);
    const type = sniff(buf);
    return type ? { buf, type } : null;
  } catch {
    return null;
  }
}

export async function deleteUpload(url: string) {
  const full = resolve(url);
  if (full) await unlink(/*turbopackIgnore: true*/ full).catch(() => undefined);
}

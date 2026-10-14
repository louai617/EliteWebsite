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

// ───────────────────────────── Documents (private) ─────────────────────────────

/**
 * Lead / client / deal documents (viewing forms, booking forms, payment proofs, QID,
 * passports…). Stored under ./storage/documents with random names and never served by a
 * public path: /api/documents/:id streams them after a permission check.
 */
const DOCS_ROOT = path.join(process.cwd(), "storage", "documents");
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function sniffDocument(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  const image = sniff(buf);
  return image && DOCUMENT_TYPES[image] ? image : null;
}

export async function saveDocumentFile(file: File) {
  if (file.size === 0) throw invalid("The file is empty.", { file: ["Empty file"] });
  if (file.size > MAX_DOCUMENT_BYTES) throw invalid("Documents must be 10 MB or smaller.", { file: ["Max 10 MB"] });
  const buf = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffDocument(buf);
  if (!mimeType) throw invalid("Upload a PDF or a photo (JPG, PNG or WebP).", { file: ["PDF, JPG, PNG or WebP only"] });
  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const storageKey = `${folder}/${randomUUID()}.${DOCUMENT_TYPES[mimeType]}`;
  await mkdir(/*turbopackIgnore: true*/ path.join(DOCS_ROOT, folder), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ path.join(DOCS_ROOT, storageKey), buf);
  return { storageKey, mimeType, size: buf.length };
}

function resolveDocument(storageKey: string) {
  const full = path.resolve(DOCS_ROOT, storageKey);
  return full.startsWith(DOCS_ROOT + path.sep) ? full : null;
}

export async function readDocumentFile(storageKey: string) {
  const full = resolveDocument(storageKey);
  if (!full) return null;
  return readFile(/*turbopackIgnore: true*/ full).catch(() => null);
}

export async function deleteDocumentFile(storageKey: string) {
  const full = resolveDocument(storageKey);
  if (full) await unlink(/*turbopackIgnore: true*/ full).catch(() => undefined);
}

/** A safe download name: letters, digits, dots, dashes; keeps the extension we detected. */
export function safeFileName(name: string, mimeType: string) {
  const ext = DOCUMENT_TYPES[mimeType] ?? "bin";
  const base = name.replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[^a-zA-Z0-9._ -]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "document";
  return `${base}.${ext}`;
}

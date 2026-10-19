import "server-only";
import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { invalid } from "@/lib/errors";

/**
 * Local file storage. Property photos live in ./storage/uploads (outside /public so they are
 * served through an access-checked route and work in production builds); they are written by
 * services/photos.ts. Swap this module for S3/R2/Cloudinary later without touching callers.
 */
const ROOT = path.join(process.cwd(), "storage", "uploads");
export const PUBLIC_PREFIX = "/api/uploads/";

function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(4, 12).toString("ascii").startsWith("ftypavi")) return "image/avif";
  return null;
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

// ───────────────────────────── Listing media (videos, floor plans, brochures) ─────────────────────────────

/**
 * Uploaded listing media lives in ./storage/media/<propertyId>/ and is streamed by
 * /api/media/:id (with HTTP range support for video seeking). Uploads are written to disk
 * chunk by chunk, so a 200 MB video never sits in memory.
 */
const MEDIA_ROOT = path.join(process.cwd(), "storage", "media");

export type UploadableMediaKind = "VIDEO" | "FLOOR_PLAN" | "BROCHURE";

export const MEDIA_RULES: Record<UploadableMediaKind, { maxBytes: number; types: Record<string, string>; label: string }> = {
  VIDEO: { maxBytes: 200 * 1024 * 1024, types: { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" }, label: "MP4, MOV or WebM, up to 200 MB" },
  FLOOR_PLAN: { maxBytes: 15 * 1024 * 1024, types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }, label: "JPG, PNG, WebP or PDF, up to 15 MB" },
  BROCHURE: { maxBytes: 30 * 1024 * 1024, types: { "application/pdf": "pdf" }, label: "PDF, up to 30 MB" },
};

function sniffMedia(head: Buffer): string | null {
  if (head.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (head.subarray(4, 8).toString("ascii") === "ftyp") return head.subarray(8, 12).toString("ascii") === "qt  " ? "video/quicktime" : "video/mp4";
  if (head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "video/webm";
  return sniff(head);
}

/** Streams an upload to disk; rejects (and removes the file) when too big or the wrong type. */
export async function saveMediaStream(propertyId: string, kind: UploadableMediaKind, body: ReadableStream<Uint8Array>) {
  const rules = MEDIA_RULES[kind];
  const folder = propertyId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!folder) throw invalid("Invalid property.");
  const dir = path.join(MEDIA_ROOT, folder);
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const tmpName = `${randomUUID()}.part`;
  const tmpPath = path.join(dir, tmpName);
  const out = createWriteStream(/*turbopackIgnore: true*/ tmpPath);
  let size = 0;
  let head = Buffer.alloc(0);
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > rules.maxBytes) throw invalid(`The file is too large (${rules.label}).`, { file: ["Too large"] });
      if (head.length < 16) head = Buffer.concat([head, Buffer.from(value.subarray(0, 16 - head.length))]);
      if (!out.write(value)) await new Promise<void>((resolve) => out.once("drain", () => resolve()));
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
    if (size === 0) throw invalid("The file is empty.", { file: ["Empty file"] });
    const mimeType = sniffMedia(head);
    const ext = mimeType ? rules.types[mimeType] : undefined;
    if (!mimeType || !ext) throw invalid(`Unsupported file — use ${rules.label}.`, { file: ["Wrong type"] });
    const storageKey = `${folder}/${tmpName.replace(/\.part$/, `.${ext}`)}`;
    await rename(/*turbopackIgnore: true*/ tmpPath, path.join(MEDIA_ROOT, storageKey));
    return { storageKey, mimeType, size };
  } catch (error) {
    reader.cancel().catch(() => undefined);
    out.destroy();
    await unlink(/*turbopackIgnore: true*/ tmpPath).catch(() => undefined);
    throw error;
  }
}

function resolveMedia(storageKey: string) {
  const full = path.resolve(MEDIA_ROOT, storageKey);
  return full.startsWith(MEDIA_ROOT + path.sep) ? full : null;
}

/** Size + a stream for [start, end] (inclusive) of an uploaded media file. */
export async function openMediaFile(storageKey: string) {
  const full = resolveMedia(storageKey);
  if (!full) return null;
  try {
    const { size } = await stat(/*turbopackIgnore: true*/ full);
    return { size, stream: (start: number, end: number) => createReadStream(/*turbopackIgnore: true*/ full, { start, end }) };
  } catch {
    return null;
  }
}

export async function deleteMediaFile(storageKey: string) {
  const full = resolveMedia(storageKey);
  if (full) await unlink(/*turbopackIgnore: true*/ full).catch(() => undefined);
}

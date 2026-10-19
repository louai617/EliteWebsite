/**
 * Browser side of listing photo uploads (the server re-encodes every photo anyway, see
 * services/photos.ts):
 *
 *  - preparePhoto: phone photos (5–15 MB, 12–48 MP) are shrunk in the browser to 3000 px JPEG
 *    before they are sent, so uploads are quick on mobile data. Small files go as they are.
 *  - uploadPhoto: XHR upload to POST /api/properties/:id/photos with progress events.
 *  - runQueue: uploads a few photos at a time, in order.
 */

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif";
export const MAX_PHOTOS = 40;
/** Files bigger than this can't be uploaded even after shrinking (the server limit is 10 MB). */
export const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const RESIZE_EDGE = 3000;
const SHRINK_ABOVE_BYTES = 2.5 * 1024 * 1024;

export interface UploadedPhoto {
  id: string;
  url: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  isPrimary: boolean;
  sortOrder: number;
  lowRes: boolean;
}

export const isImageFile = (f: File) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|avif|heic|heif)$/i.test(f.name);

/** Shrinks big photos in the browser (keeps orientation). Falls back to the original file. */
export async function preparePhoto(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // e.g. HEIC in Chrome: the server explains what to do
  }
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    if (longEdge <= RESIZE_EDGE && file.size <= SHRINK_ABOVE_BYTES) return file;
    const scale = Math.min(1, RESIZE_EDGE / longEdge);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; // transparent PNGs become white, not black
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob && blob.size < file.size ? blob : file;
  } finally {
    bitmap.close();
  }
}

const PREVIEW_EDGE = 480;

/**
 * A small preview (object URL) for a picked photo, so the page never decodes 12–48 MP
 * originals just to show tiles. Falls back to the file itself; call URL.revokeObjectURL later.
 */
export async function makePreview(file: File): Promise<string> {
  try {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image", resizeWidth: PREVIEW_EDGE * 2, resizeQuality: "medium" });
    } catch {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    }
    try {
      const scale = Math.min(1, PREVIEW_EDGE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
      if (blob) return URL.createObjectURL(blob);
    } finally {
      bitmap.close();
    }
  } catch {
    // Not decodable here (e.g. HEIC in Chrome): the browser may still show the file itself.
  }
  return URL.createObjectURL(file);
}

export class PhotoUploadError extends Error {
  /** Network or server trouble (worth a retry), as opposed to a refused photo. */
  constructor(message: string, readonly retryable = false) {
    super(message);
  }
}

/** Uploads one photo with progress (0–1). Resolves with the stored photo. */
export function uploadPhoto(propertyId: string, blob: Blob, name: string, onProgress: (p: number) => void, signal?: AbortSignal): Promise<UploadedPhoto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/properties/${encodeURIComponent(propertyId)}/photos`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const body = xhr.response as { ok: boolean; data?: UploadedPhoto; error?: { message: string } } | null;
      if (body?.ok && body.data) resolve(body.data);
      else reject(new PhotoUploadError(body?.error?.message ?? (xhr.status === 413 ? "The photo is too large." : `Upload failed (HTTP ${xhr.status}).`), xhr.status >= 500 || xhr.status === 429));
    };
    xhr.onerror = () => reject(new PhotoUploadError("Network error — check your connection and retry.", true));
    xhr.onabort = () => reject(new PhotoUploadError("Cancelled"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    const form = new FormData();
    const ext = blob.type === "image/jpeg" ? "jpg" : (name.split(".").pop() ?? "jpg");
    form.set("file", blob, `${name.replace(/\.[^.]*$/, "") || "photo"}.${ext}`);
    xhr.send(form);
  });
}

/** Runs `worker` over `items`, `concurrency` at a time, starting them in order. */
export async function runQueue<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  });
  await Promise.all(lanes);
}

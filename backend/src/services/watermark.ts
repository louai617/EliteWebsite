import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { WatermarkPosition } from "@/generated/prisma/enums";

/**
 * The company watermark stamped on the public copies of listing photos (the clean originals
 * are kept privately, see services/photos.ts).
 *
 * The ELITE logo (public/logo.png) is turned into a white mark: gold areas become white, the
 * dark building lines become see-through, so the emblem stays readable at any size. A soft
 * shadow under it keeps it visible on bright skies and white walls alike.
 */

export interface WatermarkOptions {
  enabled: boolean;
  position: WatermarkPosition;
  /** Logo width, % of the photo's width (10–60). */
  size: number;
  /** Opacity, % (10–90). */
  opacity: number;
}

const LOGO = path.join(process.cwd(), "public", "logo.png");
let whiteLogo: Promise<Buffer> | null = null;

/** The logo as a white RGBA mark (built once per process). */
function logoMark() {
  whiteLogo ??= (async () => {
    const { data, info } = await sharp(await readFile(/*turbopackIgnore: true*/ LOGO)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    // Brightness of the opaque pixels sets the mark's alpha: gold → solid, black lines → clear.
    let maxLum = 1;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 128) maxLum = Math.max(maxLum, 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    const out = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i += 4) {
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / maxLum;
      out[i] = out[i + 1] = out[i + 2] = 255;
      out[i + 3] = Math.round(data[i + 3] * Math.min(1, Math.max(0, (lum - 0.25) / 0.6)));
    }
    return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).trim().png().toBuffer();
  })();
  return whiteLogo;
}

/** Multiplies a PNG's alpha by `factor` (0–1). */
async function fade(png: Buffer, factor: number) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * factor);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/**
 * Returns `photo` (any format sharp reads; `width`×`height` px) with the watermark, encoded as
 * WebP. The result is a finished image on purpose: sharp resizes before it composites, so
 * resizing in the same pipeline would misplace the mark — make thumbnails from this buffer.
 */
export async function renderWatermarked(photo: Buffer, width: number, height: number, opts: WatermarkOptions, quality = 82) {
  const encode = (img: ReturnType<typeof sharp>) => img.webp({ quality, effort: 5, smartSubsample: true }).toBuffer();
  if (!opts.enabled) return encode(sharp(photo));

  // Size from the width, but never taller than a fifth of the photo (portrait shots).
  const logoMeta = await sharp(await logoMark()).metadata();
  const ratio = (logoMeta.height ?? 1) / (logoMeta.width ?? 1);
  let w = Math.round((width * Math.min(60, Math.max(10, opts.size))) / 100);
  if (w * ratio > height / 5) w = Math.round(height / 5 / ratio);
  w = Math.max(60, w);
  const mark = await sharp(await logoMark()).resize({ width: w }).png().toBuffer();
  const markMeta = await sharp(mark).metadata();
  const mw = markMeta.width ?? w;
  const mh = markMeta.height ?? Math.round(w * ratio);
  const alpha = Math.min(90, Math.max(10, opts.opacity)) / 100;

  // Soft dark shadow: the same shape in black, blurred, a little offset.
  const pad = Math.max(4, Math.round(mw * 0.04));
  const shadowShape = await sharp(mark).linear([0, 0, 0, 1], [0, 0, 0, 0]).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(Math.max(1, pad / 2)).png().toBuffer();
  const [front, shadow] = await Promise.all([fade(mark, alpha), fade(shadowShape, alpha * 0.55)]);

  const margin = Math.round(Math.min(width, height) * 0.04);
  const left =
    opts.position === "BOTTOM_LEFT" ? margin : opts.position === "BOTTOM_RIGHT" ? width - mw - margin : Math.round((width - mw) / 2);
  const top = opts.position === "CENTER" ? Math.round((height - mh) / 2) : height - mh - margin;
  const offset = Math.max(1, Math.round(mw * 0.006));

  return encode(
    sharp(photo).composite([
      { input: shadow, left: Math.max(0, left - pad + offset), top: Math.max(0, top - pad + offset) },
      { input: front, left: Math.max(0, left), top: Math.max(0, top) },
    ]),
  );
}

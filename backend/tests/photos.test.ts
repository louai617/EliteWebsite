/**
 * Listing photos: the optimization pipeline (rotation, metadata stripping, size caps, WebP,
 * thumbnails, blurred previews), validation, duplicates, permissions, the public API and
 * file clean-up.
 *   npm test   (uses a throwaway ./test.db, never the dev database)
 */
import "dotenv/config";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { toPublicError } from "@/lib/errors";
import { propertySchema } from "@/schemas/property";
import { PHOTO_RULES, processPhoto } from "@/services/photos";
import { createProperty, deleteProperty, removePropertyImage, reorderImages, setPrimaryImage, uploadPropertyPhoto } from "@/services/properties";
import { getPublicListing, listPublicListings } from "@/services/public-listings";
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
const fileOnDisk = (url: string) => path.join(process.cwd(), "storage", "uploads", url.replace(/^\/api\/uploads\//, ""));

/** A noisy test photo (noise keeps encoders honest about size). */
async function photo(width: number, height: number, opts: { format?: "jpeg" | "png" | "webp"; orientation?: number; exif?: boolean; seed?: number } = {}) {
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  let x = opts.seed ?? 7;
  for (let i = 0; i < raw.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    raw[i] = (i % channels === 0 ? 120 : 60) + (x % 90);
  }
  let img = sharp(raw, { raw: { width, height, channels } });
  if (opts.exif) img = img.withExif({ IFD0: { Artist: "Owner Name", Copyright: "Secret Street 12", Make: "PhoneMaker" } });
  if (opts.orientation) img = img.withMetadata({ orientation: opts.orientation });
  const fmt = opts.format ?? "jpeg";
  const buf = await (fmt === "png" ? img.png() : fmt === "webp" ? img.webp() : img.jpeg({ quality: 95 })).toBuffer();
  return buf;
}
const asFile = (buf: Buffer, name = "photo.jpg", type = "image/jpeg") => new File([new Uint8Array(buf)], name, { type });

async function main() {
  // ── Pipeline ──
  const big = await photo(4000, 3000, { exif: true, orientation: 6 });
  const out = await processPhoto(big);
  const outMeta = await sharp(out.full).metadata();
  check("stored as WebP", outMeta.format === "webp");
  check("rotated upright from EXIF (portrait) and capped at 2560 px", out.width === 1920 && out.height === 2560 && outMeta.width === 1920 && outMeta.height === 2560, { w: out.width, h: out.height });
  check("all metadata removed (EXIF, GPS, orientation)", !outMeta.exif && !outMeta.orientation && !outMeta.xmp && !outMeta.iptc, { exif: Boolean(outMeta.exif), o: outMeta.orientation });
  check("much smaller than the original", out.full.length < big.length / 2, { before: big.length, after: out.full.length });
  const thumbMeta = await sharp(out.thumb).metadata();
  check("640 px WebP thumbnail", thumbMeta.format === "webp" && Math.max(thumbMeta.width ?? 0, thumbMeta.height ?? 0) === 640);
  check("blurred preview is a tiny data URL", out.blurDataUrl.startsWith("data:image/webp;base64,") && out.blurDataUrl.length < 1200, out.blurDataUrl.length);
  check("checksum is SHA-256 of the upload", /^[0-9a-f]{64}$/.test(out.checksum));
  check("large photos aren't flagged low-res", !out.lowRes);
  const small = await processPhoto(await photo(1000, 750));
  check("small photos are never enlarged", small.width === 1000 && small.height === 750);
  check("under 1600 px is flagged low-res", small.lowRes);
  check("PNG and WebP are accepted", (await processPhoto(await photo(900, 700, { format: "png" }))).width === 900 && (await processPhoto(await photo(900, 700, { format: "webp" }))).width === 900);
  await rejects("tiny images are refused", () => sharp({ create: { width: 300, height: 200, channels: 3, background: "#888" } }).jpeg().toBuffer().then(processPhoto), /too small/i);
  await rejects("non-images are refused", () => processPhoto(Buffer.from("%PDF-1.4 not a photo at all")), /JPG, PNG, WebP or AVIF/);
  await rejects("SVG is refused (never reaches the renderer)", () => processPhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000"/>')), /JPG, PNG, WebP or AVIF/);
  await rejects("HEIC gets a helpful message", () => processPhoto(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(64)])), /HEIC/);
  await rejects("truncated / corrupt JPEGs are refused", () => processPhoto(big.subarray(0, Math.floor(big.length / 3))), /damaged|could not be processed/i);
  await rejects("over 10 MB is refused", () => processPhoto(Buffer.alloc(PHOTO_RULES.maxBytes + 1, 0xff)), /10 MB/);

  // ── Uploading to a listing ──
  const omar = await actorFor("omar@elite.qa");
  const aisha = await actorFor("aisha@elite.qa");
  const owner = await db.owner.findFirstOrThrow({ select: { id: true } });
  const p = await createProperty(omar, propertySchema.parse({ title: "Photo test apartment", type: "APARTMENT", purpose: "RENT", status: "AVAILABLE", price: "15000", currency: "QAR", country: "Qatar", city: "Doha", area: "Lusail", bedrooms: "2", ownerId: owner.id, agentId: null, websitePublished: true }));
  const first = await uploadPropertyPhoto(omar, p.id, asFile(big));
  check("first upload becomes the cover", first.isPrimary && first.sortOrder === 0);
  check("upload returns the stored sizes", first.width === 1920 && first.height === 2560 && (first.bytes ?? 0) > 0 && first.lowRes === false);
  check("photo and thumbnail are written to disk", existsSync(fileOnDisk(first.url)) && existsSync(fileOnDisk(first.thumbUrl!)) && first.url.endsWith(".webp"));
  check("the stored file matches the recorded size", statSync(fileOnDisk(first.url)).size === first.bytes);
  await rejects("the same photo can't be added twice", () => uploadPropertyPhoto(omar, p.id, asFile(big)), /already in the listing/);
  const another = await photo(1200, 900, { seed: 3 });
  await rejects("other agents can't upload to the listing", () => uploadPropertyPhoto(aisha, p.id, asFile(another)), /own listings/);
  await rejects("a fake image is refused before anything is stored", () => uploadPropertyPhoto(omar, p.id, asFile(Buffer.from("GIF89a....not really"), "x.jpg")), /JPG, PNG, WebP or AVIF/);
  const second = await uploadPropertyPhoto(omar, p.id, asFile(await photo(1200, 900, { seed: 11 })));
  const third = await uploadPropertyPhoto(omar, p.id, asFile(await photo(2400, 1600, { seed: 12, format: "png" }), "c.png", "image/png"));
  check("later uploads are appended in order", second.sortOrder === 1 && third.sortOrder === 2 && !second.isPrimary);
  check("low-res uploads are flagged", second.lowRes === true);
  await reorderImages(omar, p.id, [third.id, first.id, second.id]);
  await setPrimaryImage(omar, third.id);

  // ── Public API ──
  const card = (await listPublicListings({ q: p.reference }, { page: 1, pageSize: 5, sort: "newest" }, "http://api.test")).items[0];
  check("cards start with the cover photo (absolute URL)", card?.images[0] === `http://api.test${third.url}`, card?.images);
  check("cards carry the cover's blurred preview", card?.cover_blur?.startsWith("data:image/webp;base64,"));
  const detail = await getPublicListing(p.reference, "http://api.test");
  check("detail has blurred previews for the hero photos", detail?.image_blurs.length === 3 && detail.image_blurs.every((b) => b?.startsWith("data:image/webp")));
  check("the public API never exposes checksums or file sizes", !/checksum|"bytes"/.test(JSON.stringify(detail)));

  // ── Removing ──
  await removePropertyImage(omar, third.id);
  check("removing deletes the photo and its thumbnail", !existsSync(fileOnDisk(third.url)) && !existsSync(fileOnDisk(third.thumbUrl!)));
  check("the next photo becomes the cover", (await db.propertyImage.findUniqueOrThrow({ where: { id: first.id } })).isPrimary);
  const pasted = await db.propertyImage.create({ data: { propertyId: p.id, url: "https://images.unsplash.com/photo-1", sortOrder: 9 } });
  check("pasted URLs keep working without thumbnails", pasted.thumbUrl === null);
  await deleteProperty(await actorFor("fatima@elite.qa"), p.id);
  check("deleting the listing deletes every photo file", ![first, second].some((i) => existsSync(fileOnDisk(i.url)) || existsSync(fileOnDisk(i.thumbUrl!))));

  console.log(`photo tests: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

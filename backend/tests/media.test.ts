/**
 * Listing media: link parsing (YouTube, Vimeo, Matterport, Kuula), permissions, streaming
 * uploads with type checks, ordering, public API output and file clean-up.
 *   npm test   (uses a throwaway ./test.db, never the dev database)
 */
import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { toPublicError } from "@/lib/errors";
import { parseMediaLink } from "@/lib/media-links";
import { mediaLinkSchema } from "@/schemas/media";
import { propertySchema } from "@/schemas/property";
import { createProperty, deleteProperty } from "@/services/properties";
import { addMediaLink, deleteMedia, listMedia, moveMedia, uploadMedia } from "@/services/property-media";
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
const stream = (bytes: Buffer) => new Blob([new Uint8Array(bytes)]).stream();
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(64)]);
const pdf = Buffer.from("%PDF-1.4\n% brochure\n%%EOF\n");
const fileOf = (key: string) => path.join(process.cwd(), "storage", "media", key);

async function main() {
  // ── Link parsing ──
  const yt = parseMediaLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10");
  check("YouTube watch link → privacy-friendly embed", yt?.provider === "youtube" && yt.embedUrl === "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
  check("youtu.be and Shorts links", parseMediaLink("https://youtu.be/dQw4w9WgXcQ")?.provider === "youtube" && parseMediaLink("https://youtube.com/shorts/dQw4w9WgXcQ")?.provider === "youtube");
  check("Vimeo link → player", parseMediaLink("https://vimeo.com/123456789")?.embedUrl === "https://player.vimeo.com/video/123456789");
  check("Matterport tour → embed", parseMediaLink("https://my.matterport.com/show/?m=SxQL3iGyoDo")?.provider === "matterport");
  check("Kuula tour → embed", parseMediaLink("https://kuula.co/share/collection/7lVLq")?.embedUrl === "https://kuula.co/share/collection/7lVLq");
  check("other hosts are links only (never framed)", parseMediaLink("https://example.com/tour")?.embedUrl === null);
  check("http and junk are rejected", parseMediaLink("http://youtube.com/watch?v=dQw4w9WgXcQ") === null && parseMediaLink("javascript:alert(1)") === null);
  check("a fake YouTube id isn't embedded", parseMediaLink("https://youtube.com/watch?v=<script>")?.provider === "link");

  // ── Permissions & validation ──
  const omar = await actorFor("omar@elite.qa");
  const aisha = await actorFor("aisha@elite.qa");
  const manager = await actorFor("fatima@elite.qa");
  const owner = await db.owner.findFirstOrThrow({ select: { id: true } });
  const p = await createProperty(omar, propertySchema.parse({ title: "Media test villa", type: "VILLA", purpose: "SALE", status: "AVAILABLE", price: "4000000", currency: "QAR", country: "Qatar", city: "Doha", area: "West Bay", bedrooms: "5", ownerId: owner.id, agentId: null, websitePublished: true }));
  const link = (kind: "VIDEO" | "VIRTUAL_TOUR" | "FLOOR_PLAN" | "BROCHURE", url: string, title: string | null = null) => mediaLinkSchema.parse({ propertyId: p.id, kind, url, title });
  await rejects("other agents can't add media to the listing", () => addMediaLink(aisha, link("VIDEO", "https://youtu.be/dQw4w9WgXcQ")), /own listings/);
  await rejects("a tour link can't be filed as a video", () => addMediaLink(omar, link("VIDEO", "https://my.matterport.com/show/?m=SxQL3iGyoDo")), /360° tour/);
  check("schema requires a full URL", !mediaLinkSchema.safeParse({ propertyId: p.id, kind: "VIDEO", url: "youtube" }).success);
  const v1 = await addMediaLink(omar, link("VIDEO", "https://youtu.be/dQw4w9WgXcQ", "Walkthrough"));
  const tour = await addMediaLink(omar, link("VIRTUAL_TOUR", "https://my.matterport.com/show/?m=SxQL3iGyoDo"));
  check("video link stored with its embed", v1.provider === "youtube" && Boolean(v1.embedUrl));

  // ── Streaming uploads ──
  const v2 = await uploadMedia(omar, p.id, "VIDEO", "Drone", stream(mp4));
  check("MP4 upload is stored as a file", v2.provider === "file" && v2.mimeType === "video/mp4" && v2.size === mp4.length && existsSync(fileOf(v2.storageKey!)));
  await rejects("a text file isn't accepted as a video", () => uploadMedia(omar, p.id, "VIDEO", null, stream(Buffer.from("not a video at all"))), /Unsupported file/);
  await rejects("a brochure must be a PDF", () => uploadMedia(omar, p.id, "BROCHURE", null, stream(mp4)), /Unsupported file/);
  await rejects("empty uploads are rejected", () => uploadMedia(omar, p.id, "BROCHURE", null, stream(Buffer.alloc(0))), /empty/);
  await rejects("other agents can't upload", () => uploadMedia(aisha, p.id, "VIDEO", null, stream(mp4)), /own listings/);
  const leftovers = (await import("node:fs")).readdirSync(path.join(process.cwd(), "storage", "media", p.id)).filter((f) => f.endsWith(".part"));
  check("rejected uploads leave no partial files", leftovers.length === 0, leftovers);
  const brochure = await uploadMedia(omar, p.id, "BROCHURE", "Brochure", stream(pdf));
  check("PDF brochure uploaded", brochure.mimeType === "application/pdf");

  // ── Ordering ──
  await moveMedia(omar, v2.id, "up");
  const videos = (await listMedia(p.id)).filter((m) => m.kind === "VIDEO");
  check("moving up puts the uploaded video first", videos[0]?.id === v2.id, videos.map((v) => v.id));

  // ── Public website output ──
  const publicListing = await getPublicListing(p.reference, "http://api.test");
  check("listing exposes videos, tours and brochure", publicListing?.media.videos.length === 2 && publicListing.media.tours.length === 1 && publicListing.media.brochure?.url === `http://api.test/api/media/${brochure.id}`);
  check("uploaded video has an absolute file URL", publicListing?.media.videos[0]?.url === `http://api.test/api/media/${v2.id}`);
  check("embeds come only from the server", publicListing?.media.tours[0]?.embed_url?.startsWith("https://my.matterport.com/show/"));
  const card = (await listPublicListings({ q: p.reference }, { page: 1, pageSize: 5, sort: "newest" }, "http://api.test")).items.find((c) => c.reference_number === p.reference);
  check("cards flag video and 360° tour", card?.has_video === true && card.has_tour === true);

  // ── Removal ──
  await deleteMedia(omar, tour.id);
  await deleteMedia(omar, v2.id);
  check("removing an upload deletes its file", !existsSync(fileOf(v2.storageKey!)));
  await rejects("other agents can't remove media", () => deleteMedia(aisha, v1.id), /own listings/);
  await deleteProperty(manager, p.id);
  check("deleting the listing deletes its media rows and files", (await db.propertyMedia.count({ where: { propertyId: p.id } })) === 0 && !existsSync(fileOf(brochure.storageKey!)));

  console.log(`media tests: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

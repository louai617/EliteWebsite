/**
 * Recognises video / virtual-tour links and builds embeddable player URLs.
 * Client-safe (used by the media form for an instant preview and by the server on save).
 *
 * Only these hosts are embedded (iframes); any other https link is kept as a plain
 * "open in a new tab" link, so a listing can never frame an arbitrary site.
 */

export type MediaProvider = "youtube" | "vimeo" | "matterport" | "kuula" | "link";

export interface ParsedMediaLink {
  url: string;
  provider: MediaProvider;
  embedUrl: string | null;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
    return m?.[1] ?? null;
  }
  return null;
}

export function parseMediaLink(raw: string): ParsedMediaLink | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const url = u.toString();
  const host = u.hostname.replace(/^www\./, "");

  const yt = youtubeId(u);
  if (yt && YT_ID.test(yt)) return { url, provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?rel=0` };

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.match(/(?:^|\/)(\d{6,12})(?:\/|$)/)?.[1];
    if (id) return { url, provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` };
  }

  if (host === "my.matterport.com" || host === "matterport.com") {
    const id = u.searchParams.get("m");
    if (id && /^[A-Za-z0-9]{6,20}$/.test(id)) return { url, provider: "matterport", embedUrl: `https://my.matterport.com/show/?m=${id}&play=1` };
  }

  if (host === "kuula.co" && /^\/(share|post)\//.test(u.pathname)) {
    return { url, provider: "kuula", embedUrl: `https://kuula.co${u.pathname}` };
  }

  return { url, provider: "link", embedUrl: null };
}

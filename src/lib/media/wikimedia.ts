import { fetchJson } from "../http";

// Wikimedia asks browser-side clients to identify themselves with this header.
// Browsers ignore User-Agent here (forbidden header) and send their own; Node honours it.
const UA = "AnkiQuickAdd/2.0 (Chrome extension)";
export const WIKIMEDIA_HEADERS = { "Api-User-Agent": UA, "User-Agent": UA };

export function wikiApi<T>(host: string, params: Record<string, string | number>): Promise<T> {
  const query = new URLSearchParams({ format: "json", formatversion: "2", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  return fetchJson<T>(`https://${host}/w/api.php?${query}`, { headers: WIKIMEDIA_HEADERS });
}

export interface ExtMetadata {
  Artist?: { value: string };
  LicenseShortName?: { value: string };
  LicenseUrl?: { value: string };
}

export interface ImageInfo {
  url: string;
  thumburl?: string;
  descriptionurl?: string;
  mime?: string;
  extmetadata?: ExtMetadata;
}

export function extensionForMime(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
    case "application/ogg":
      return "ogg";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default:
      return null;
  }
}

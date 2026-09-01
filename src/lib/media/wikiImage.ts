import { bytesToBase64 } from "../base64";
import { fetchBytes } from "../http";
import { stripHtml } from "../note/mustache";
import type { Settings } from "../settings/schema";
import { escapeHtml } from "../text";
import { mediaBaseName } from "./audio";
import type { MediaCredit, MediaResult } from "./types";
import { type ImageInfo, WIKIMEDIA_HEADERS, extensionForMime, wikiApi } from "./wikimedia";

interface PageImagesResponse {
  query?: { pages?: { missing?: boolean; pageimage?: string; thumbnail?: { source: string }; pageprops?: { disambiguation?: string } }[] };
}

interface ImageInfoResponse {
  query?: { pages?: { title: string; imageinfo?: ImageInfo[] }[] };
}

export interface ImagePick {
  thumbUrl: string;
  info?: ImageInfo;
}

const BITMAP = /^image\/(jpeg|png|gif|webp)$/;

// Article's lead image, unless the title is missing or a disambiguation page.
export function pickPageImage(res: PageImagesResponse): { fileName: string; thumbUrl: string } | null {
  const page = res.query?.pages?.[0];
  if (!page || page.missing || page.pageprops?.disambiguation !== undefined || !page.pageimage || !page.thumbnail) return null;
  return { fileName: page.pageimage, thumbUrl: page.thumbnail.source };
}

// First bitmap hit of a Commons search.
export function pickCommonsImage(res: ImageInfoResponse): ImagePick | null {
  for (const page of res.query?.pages ?? []) {
    const info = page.imageinfo?.[0];
    if (info?.mime && BITMAP.test(info.mime) && info.thumburl) return { thumbUrl: info.thumburl, info };
  }
  return null;
}

export function buildCredit(info: ImageInfo | undefined): MediaCredit | undefined {
  if (!info) return undefined;
  const artist = stripHtml(info.extmetadata?.Artist?.value ?? "").trim();
  const license = info.extmetadata?.LicenseShortName?.value?.trim();
  const parts = [artist && escapeHtml(artist), license && escapeHtml(license)].filter(Boolean);
  const link = info.descriptionurl ? `<a href="${escapeHtml(info.descriptionurl)}">Wikimedia Commons</a>` : "Wikimedia Commons";
  return { html: [...parts, link].join(" · "), license, url: info.descriptionurl };
}

async function fileInfo(host: string, fileName: string): Promise<ImageInfo | undefined> {
  const res = await wikiApi<ImageInfoResponse>(host, {
    action: "query",
    titles: `File:${fileName}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl",
  }).catch(() => undefined);
  return res?.query?.pages?.[0]?.imageinfo?.[0];
}

export async function findWikiImage(query: string, settings: Settings): Promise<ImagePick | null> {
  const host = `${settings.languages.source}.wikipedia.org`;
  const width = settings.media.image.maxWidth;
  const page = await wikiApi<PageImagesResponse>(host, {
    action: "query",
    titles: query,
    prop: "pageimages|pageprops",
    ppprop: "disambiguation",
    piprop: "name|thumbnail",
    pithumbsize: width,
    redirects: 1,
  }).catch(() => undefined);
  const lead = page ? pickPageImage(page) : null;
  if (lead) return { thumbUrl: lead.thumbUrl, info: await fileInfo(host, lead.fileName) };

  const commons = await wikiApi<ImageInfoResponse>("commons.wikimedia.org", {
    action: "query",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: 6,
    gsrlimit: 5,
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: width,
    iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl",
  }).catch(() => undefined);
  return commons ? pickCommonsImage(commons) : null;
}

export async function resolveImage(word: string, query: string, settings: Settings): Promise<MediaResult | null> {
  if (!settings.media.image.enabled) return null;
  const pick = await findWikiImage(query, settings);
  if (!pick) return null;
  const { bytes, mime } = await fetchBytes(pick.thumbUrl, { headers: WIKIMEDIA_HEADERS });
  const ext = extensionForMime(mime) ?? "jpg";
  const credit = settings.media.image.storeCredit ? buildCredit(pick.info) : undefined;
  return {
    kind: "image",
    filename: `${mediaBaseName("aqa_img", settings.languages.source, word)}.${ext}`,
    data: bytesToBase64(bytes),
    mime,
    source: "wikimedia",
    ...(credit ? { credit } : {}),
  };
}

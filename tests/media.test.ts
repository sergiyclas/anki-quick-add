import { afterEach, expect, test, vi } from "vitest";
import { pickDictionaryAudio } from "../src/lib/media/dictionaryApi";
import { buildCredit, pickCommonsImage, pickPageImage, resolveImage } from "../src/lib/media/wikiImage";
import { pickWiktionaryAudio } from "../src/lib/media/wiktionaryAudio";
import { DEFAULT_SETTINGS } from "../src/lib/settings/schema";
import { normalizeWord } from "../src/lib/text";
import { mockFetch } from "./helpers/mockFetch";

afterEach(() => vi.unstubAllGlobals());

test("dictionaryapi: US recording preferred, then UK, then any mp3", () => {
  const entries = [{ phonetics: [{ text: "/həˈləʊ/", audio: "" }, { audio: "https://x/hello-uk.mp3" }, { audio: "https://x/hello-us.mp3" }] }];
  expect(pickDictionaryAudio(entries)).toBe("https://x/hello-us.mp3");
  expect(pickDictionaryAudio([{ phonetics: [{ audio: "https://x/hello-au.mp3" }, { audio: "https://x/hello-uk.mp3" }] }])).toBe("https://x/hello-uk.mp3");
  expect(pickDictionaryAudio([{ phonetics: [{ audio: "" }] }, {}])).toBeNull();
});

const wiktionaryPages = [
  { title: "File:En-us-hello.ogg", imageinfo: [{ url: "https://u/En-us-hello.ogg", mime: "audio/ogg" }] },
  { title: "File:En-uk-hello.ogg", imageinfo: [{ url: "https://u/En-uk-hello.ogg", mime: "audio/ogg" }] },
  { title: "File:LL-Q1860 (eng)-Vealhurl-hello.wav", imageinfo: [{ url: "https://u/ll-hello.wav", mime: "audio/wav" }] },
  { title: "File:De-Hallo.ogg", imageinfo: [{ url: "https://u/De-Hallo.ogg", mime: "audio/ogg" }] },
  { title: "File:Hello.svg", imageinfo: [{ url: "https://u/Hello.svg", mime: "image/svg+xml" }] },
];

test("wiktionary: filters by language prefix or (iso3), respects the ogg switch, prefers mp3 > wav > ogg and US", () => {
  expect(pickWiktionaryAudio(wiktionaryPages, "en", false)?.title).toBe("File:LL-Q1860 (eng)-Vealhurl-hello.wav");
  const withOgg = [...wiktionaryPages, { title: "File:En-us-hello.mp3", imageinfo: [{ url: "https://u/x.mp3", mime: "audio/mpeg" }] }];
  expect(pickWiktionaryAudio(withOgg, "en", true)?.title).toBe("File:En-us-hello.mp3");
  expect(pickWiktionaryAudio(wiktionaryPages.slice(0, 2), "en", true)?.title).toBe("File:En-us-hello.ogg");
  expect(pickWiktionaryAudio(wiktionaryPages, "de", true)?.title).toBe("File:De-Hallo.ogg");
  expect(pickWiktionaryAudio(wiktionaryPages, "de", false)).toBeNull();
});

test("wikipedia lead image: skips disambiguation and missing pages", () => {
  expect(pickPageImage({ query: { pages: [{ pageimage: "Apple.jpg", thumbnail: { source: "https://t/Apple.jpg" } }] } })).toEqual({ fileName: "Apple.jpg", thumbUrl: "https://t/Apple.jpg" });
  expect(pickPageImage({ query: { pages: [{ pageimage: "M.jpg", thumbnail: { source: "x" }, pageprops: { disambiguation: "" } }] } })).toBeNull();
  expect(pickPageImage({ query: { pages: [{ missing: true }] } })).toBeNull();
  expect(pickPageImage({ query: { pages: [{ pageimage: "NoThumb.jpg" }] } })).toBeNull();
});

test("commons search: first bitmap wins; credit assembled from extmetadata", () => {
  const res = {
    query: {
      pages: [
        { title: "File:a.svg", imageinfo: [{ url: "u1", thumburl: "t1", mime: "image/svg+xml" }] },
        { title: "File:b.jpg", imageinfo: [{ url: "u2", thumburl: "t2", mime: "image/jpeg", descriptionurl: "https://commons/File:b.jpg", extmetadata: { Artist: { value: '<a href="x">Jane</a>' }, LicenseShortName: { value: "CC BY-SA 4.0" } } }] },
      ],
    },
  };
  const pick = pickCommonsImage(res)!;
  expect(pick.thumbUrl).toBe("t2");
  expect(buildCredit(pick.info)).toEqual({
    html: 'Jane · CC BY-SA 4.0 · <a href="https://commons/File:b.jpg">Wikimedia Commons</a>',
    license: "CC BY-SA 4.0",
    url: "https://commons/File:b.jpg",
  });
  expect(buildCredit(undefined)).toBeUndefined();
});

test("resolveImage: lead image path downloads the thumbnail and names the file by mime", async () => {
  const calls = mockFetch((call) => {
    if (call.url.includes("prop=pageimages")) return { status: 200, body: { query: { pages: [{ pageimage: "Apple.jpg", thumbnail: { source: "https://upload/Apple.jpg" } }] } } };
    if (call.url.includes("prop=imageinfo")) return { status: 200, body: { query: { pages: [{ title: "File:Apple.jpg", imageinfo: [{ url: "u", descriptionurl: "https://commons/File:Apple.jpg", extmetadata: { LicenseShortName: { value: "CC0" } } }] }] } } };
    return { status: 200, body: "PNGDATA" };
  });
  vi.mocked(fetch).mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init: init ?? {}, body: null });
    if (u.startsWith("https://upload/")) return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } });
    if (u.includes("prop=pageimages")) return Response.json({ query: { pages: [{ pageimage: "Apple.jpg", thumbnail: { source: "https://upload/Apple.jpg" } }] } });
    return Response.json({ query: { pages: [{ title: "File:Apple.jpg", imageinfo: [{ url: "u", descriptionurl: "https://commons/File:Apple.jpg", extmetadata: { LicenseShortName: { value: "CC0" } } }] }] } });
  });
  const result = await resolveImage("apple", "Apple", DEFAULT_SETTINGS);
  expect(result).toMatchObject({ kind: "image", mime: "image/png", source: "wikimedia", credit: { license: "CC0" } });
  expect(result!.filename).toMatch(/^aqa_img_en_apple_[0-9a-f]{6}\.png$/);
  expect(result!.data).toBe("AQID");
  expect(calls.some((c) => c.url.startsWith("https://en.wikipedia.org/w/api.php?") && c.url.includes("pithumbsize=480"))).toBe(true);
  expect((calls[0]!.init.headers as Record<string, string>)["Api-User-Agent"]).toContain("AnkiQuickAdd");
});

test("normalizeWord keeps case when asked (German nouns)", () => {
  expect(normalizeWord("Haus", false)).toBe("Haus");
  expect(normalizeWord("Haus")).toBe("haus");
});

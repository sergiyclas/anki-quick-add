// Live checks against public media APIs. Opt in with AQA_NET=1 (needs internet; results depend on live data).
import { describe, expect, test } from "vitest";
import { resolveAudio } from "../../src/lib/media/audio";
import { findWikiImage, resolveImage } from "../../src/lib/media/wikiImage";
import { DEFAULT_SETTINGS, type Settings } from "../../src/lib/settings/schema";

declare const process: { env: Record<string, string | undefined> };

const german: Settings = { ...DEFAULT_SETTINGS, languages: { source: "de", target: "en" } };

describe.skipIf(!process.env["AQA_NET"])("media integration", () => {
  test("apple: dictionary recording (mp3) wins over TTS", async () => {
    const audio = await resolveAudio("apple", DEFAULT_SETTINGS);
    expect(audio?.source).toBe("dictionary");
    expect(audio?.filename).toMatch(/^aqa_en_apple_[0-9a-f]{6}\.mp3$/);
    expect(audio!.data.length).toBeGreaterThan(1000);
  }, 30_000);

  test("Haus (de): TTS unless ogg is allowed, then the Wiktionary recording", async () => {
    const tts = await resolveAudio("Haus", german);
    expect(tts?.source).toBe("tts");
    const ogg = await resolveAudio("Haus", { ...german, media: { ...german.media, audio: { ...german.media.audio, allowOgg: true } } });
    expect(ogg?.source).toBe("wiktionary");
    expect(ogg?.filename).toMatch(/\.ogg$/);
  }, 30_000);

  test("images: lead image for a sense-specific query, Commons fallback for a disambiguation title", async () => {
    const bat = await resolveImage("bat", "Baseball bat", DEFAULT_SETTINGS);
    expect(bat?.kind).toBe("image");
    expect(bat?.filename).toMatch(/^aqa_img_en_bat_[0-9a-f]{6}\.(jpg|png|webp|gif)$/);
    expect(bat?.credit?.html).toContain("Wikimedia Commons");

    const mercury = await findWikiImage("Mercury", DEFAULT_SETTINGS);
    expect(mercury).not.toBeNull();
    expect(mercury!.info?.mime).toMatch(/^image\//); // came from the Commons search, which carries mime
  }, 60_000);
});

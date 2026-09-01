import { afterEach, expect, test, vi } from "vitest";
import { parseGtx, quickTranslate } from "../src/lib/quickTranslate";
import { mockFetch } from "./helpers/mockFetch";

afterEach(() => vi.unstubAllGlobals());

test("parseGtx joins sentence chunks and tolerates odd shapes", () => {
  expect(parseGtx([[["Привіт, ", "Hello, ", null, null, 10], ["світе!", "world!", null, null, 10]], null, "en"])).toBe("Привіт, світе!");
  expect(parseGtx([null, null, "en"])).toBe("");
  expect(parseGtx("nope")).toBe("");
});

test("quickTranslate calls the gtx endpoint with mapped codes and caches", async () => {
  const calls = mockFetch({ status: 200, body: [[["черга", "queue", null, null, 10]], null, "en"] });
  expect(await quickTranslate("queue", "en", "uk")).toBe("черга");
  expect(await quickTranslate("queue", "en", "uk")).toBe("черга");
  expect(calls).toHaveLength(1);
  const url = new URL(calls[0]!.url);
  expect(url.origin + url.pathname).toBe("https://translate.googleapis.com/translate_a/single");
  expect(Object.fromEntries(url.searchParams)).toEqual({ client: "gtx", sl: "en", tl: "uk", dt: "t", q: "queue" });
  await quickTranslate("hello", "zh", "he");
  expect(Object.fromEntries(new URL(calls[1]!.url).searchParams)).toMatchObject({ sl: "zh-CN", tl: "iw" });
});

import { afterEach, expect, test, vi } from "vitest";
import { translateText } from "../src/lib/translate/engine";
import { mockFetch } from "./helpers/mockFetch";

afterEach(() => vi.unstubAllGlobals());

// There is no chrome.offscreen in node, so these exercise the online path and the failure that would
// otherwise silently hand the user an empty bubble.
test("uses the online endpoint and reports which engine answered", async () => {
  const calls = mockFetch({ status: 200, body: [[["гавань", "harbor", null, null, 10]]] });
  expect(await translateText("harbor", "en", "uk")).toEqual({ text: "гавань", engine: "gtx" });
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toContain("translate_a/single");
});

test("rejects when the endpoint fails and no on-device pack can be reached", async () => {
  mockFetch({ status: 503, body: "" });
  // A word the earlier test did not put in the module cache.
  await expect(translateText("wharf", "en", "uk")).rejects.toThrow(/unavailable/i);
});

test("caches a translation instead of asking twice", async () => {
  const calls = mockFetch({ status: 200, body: [[["ліхтар", "lantern", null, null, 10]]] });
  await translateText("lantern", "en", "uk");
  await translateText("lantern", "en", "uk");
  expect(calls).toHaveLength(1);
});

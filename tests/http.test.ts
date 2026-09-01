import { afterEach, expect, test, vi } from "vitest";
import { HttpError, fetchJson } from "../src/lib/http";
import { mockFetch } from "./helpers/mockFetch";

afterEach(() => vi.unstubAllGlobals());

test("retries once on a transient 503 and then succeeds", async () => {
  const calls = mockFetch((_c, i) => (i === 0 ? { status: 503, body: { error: "high demand" } } : { status: 200, body: { ok: 1 } }));
  expect(await fetchJson("https://api.example/x")).toEqual({ ok: 1 });
  expect(calls).toHaveLength(2);
}, 10_000);

test("gives up after the second transient failure and does not retry 4xx", async () => {
  mockFetch({ status: 503, body: "busy" });
  await expect(fetchJson("https://api.example/x")).rejects.toBeInstanceOf(HttpError);
  const calls = mockFetch({ status: 400, body: "bad" });
  await expect(fetchJson("https://api.example/x")).rejects.toMatchObject({ status: 400 });
  expect(calls).toHaveLength(1);
}, 10_000);

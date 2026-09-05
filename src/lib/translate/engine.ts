// One entry point for "translate this text", with Google's endpoint first and Chrome's on-device
// translator as the fallback for when the network is gone.

import { quickTranslate } from "../quickTranslate";
import { getCache, setCache } from "../settings/storage";
import { askOffscreen } from "./offscreen";

export type TranslateEngine = "gtx" | "device";

export interface TranslateResult {
  text: string;
  engine: TranslateEngine;
}

// Vitest runs in node, where there is no chrome.offscreen: everything then goes through gtx.
const canUseDevice = (): boolean => typeof chrome !== "undefined" && Boolean(chrome.offscreen);

const DEVICE_TIMEOUT_MS = 8_000; // the first call after a wake-up also loads the model into memory
const IDLE_ALARM = "aqa-translator-idle";
const FRESH_AVAILABLE_MS = 7 * 24 * 60 * 60 * 1000;
const FRESH_OTHER_MS = 24 * 60 * 60 * 1000;

type AvailabilityCache = Record<string, { availability: AIAvailability; at: number }>;

const pairKey = (from: string, to: string) => `${from}|${to}`;

async function readAvailability(from: string, to: string): Promise<{ availability: AIAvailability; at: number } | undefined> {
  const cached = await getCache<AvailabilityCache>("translator");
  return cached?.items?.[pairKey(from, to)];
}

async function writeAvailability(from: string, to: string, availability: AIAvailability): Promise<void> {
  const cached = (await getCache<AvailabilityCache>("translator"))?.items ?? {};
  await setCache("translator", { ...cached, [pairKey(from, to)]: { availability, at: Date.now() } });
}

/** What the cache knows, without ever creating the offscreen document. */
export async function cachedAvailability(from: string, to: string): Promise<AIAvailability> {
  return (await readAvailability(from, to))?.availability ?? "unavailable";
}

/** Cached state of the on-device pack. Only probes the device when the cache is stale or `refresh` is set. */
export async function deviceAvailability(from: string, to: string, refresh = false): Promise<AIAvailability> {
  if (!canUseDevice()) return "unavailable";
  const entry = await readAvailability(from, to);
  const maxAge = entry?.availability === "available" ? FRESH_AVAILABLE_MS : FRESH_OTHER_MS;
  if (!refresh && entry && Date.now() - entry.at < maxAge) return entry.availability;

  const response = await askOffscreen({ target: "offscreen", kind: "translator.availability", from, to }).catch(() => null);
  const availability = response && response.ok && "availability" in response ? response.availability : "unavailable";
  await writeAvailability(from, to, availability);
  return availability;
}

/** Called by the options page once a language pack has finished downloading. */
export async function noteDownloaded(from: string, to: string): Promise<void> {
  await writeAvailability(from, to, "available");
}

export async function translateOnDevice(text: string, from: string, to: string): Promise<string> {
  // A cached "not ready" is never the last word: the pack may have been installed since, or a single
  // failed translation may have written that state. Ask the browser again before refusing.
  if ((await deviceAvailability(from, to)) !== "available" && (await deviceAvailability(from, to, true)) !== "available") {
    throw new Error("No offline language pack");
  }
  const response = await Promise.race([
    askOffscreen({ target: "offscreen", kind: "translator.translate", from, to, text }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Offline translator timed out")), DEVICE_TIMEOUT_MS)),
  ]);
  // Keep the document (and the loaded model) around for a few minutes of continued reading.
  await chrome.alarms.create(IDLE_ALARM, { delayInMinutes: 5 });
  if (!response.ok) {
    // The browser reported the pack as ready but the model refused: do not keep trusting that.
    await writeAvailability(from, to, "downloadable");
    throw new Error(response.error);
  }
  if (!("text" in response)) throw new Error("Unexpected offscreen reply");
  return response.text;
}

/**
 * Google first (it is what the extension has always used), the on-device pack when that fails or the
 * browser reports no connection. Rejects only when neither can answer.
 */
export async function translateText(text: string, from: string, to: string): Promise<TranslateResult> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!offline) {
    try {
      const translation = await quickTranslate(text, from, to);
      if (translation) return { text: translation, engine: "gtx" };
    } catch {
      // fall through to the device
    }
  }
  if (!canUseDevice()) throw new Error("Translation is unavailable");
  return { text: await translateOnDevice(text, from, to), engine: "device" };
}

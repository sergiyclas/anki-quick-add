// Contract between the service worker and the offscreen document. Deliberately kept out of the
// `Request` union in lib/messages.ts: the worker's router must never see these, and the offscreen
// document must never answer the extension's own messages.

export const OFFSCREEN_PATH = "offscreen/index.html";
export const OFFSCREEN_TARGET = "offscreen";

export type OffscreenRequest =
  | { target: typeof OFFSCREEN_TARGET; kind: "translator.availability"; from: string; to: string }
  | { target: typeof OFFSCREEN_TARGET; kind: "translator.translate"; from: string; to: string; text: string }
  | { target: typeof OFFSCREEN_TARGET; kind: "translator.release" };

export type OffscreenResponse =
  | { ok: true; availability: AIAvailability }
  | { ok: true; text: string }
  | { ok: true }
  | { ok: false; error: string };

export function isOffscreenRequest(value: unknown): value is OffscreenRequest {
  return (value as { target?: string } | null)?.target === OFFSCREEN_TARGET;
}

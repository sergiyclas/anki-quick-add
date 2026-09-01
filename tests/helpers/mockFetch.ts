import { vi } from "vitest";

export interface Call {
  url: string;
  init: RequestInit;
  body: Record<string, unknown> | null;
}

export type Responder = (call: Call, index: number) => { status: number; body: unknown } | Promise<{ status: number; body: unknown }>;

// Replaces global fetch; `respond` decides per call. Returns the recorded calls.
export function mockFetch(respond: Responder | { status: number; body: unknown }): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call: Call = { url, init, body: typeof init.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null };
      calls.push(call);
      const { status, body } = typeof respond === "function" ? await respond(call, calls.length - 1) : respond;
      return new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}

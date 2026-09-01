export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(
      status === 502 || status === 503 || status === 529
        ? `${new URL(url).host} is temporarily overloaded (HTTP ${status}) - try again in a moment`
        : `HTTP ${status} from ${new URL(url).host}: ${body.slice(0, 300)}`,
    );
    this.name = "HttpError";
  }
}

export interface HttpOptions extends RequestInit {
  timeoutMs?: number;
}

const TRANSIENT = new Set([502, 503, 529]);
const RETRY_DELAY_MS = 1500;

async function request(url: string, { timeoutMs = 15_000, signal, ...init }: HttpOptions): Promise<Response> {
  const attempt = async () => {
    const timeout = AbortSignal.timeout(timeoutMs);
    return fetch(url, { ...init, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  };
  let res = await attempt();
  // Providers answer "high demand" with 503/529 for a few seconds; one retry covers most of those.
  if (TRANSIENT.has(res.status)) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    res = await attempt();
  }
  if (!res.ok) throw new HttpError(res.status, url, await res.text());
  return res;
}

export async function fetchJson<T>(url: string, options: HttpOptions = {}): Promise<T> {
  const res = await request(url, options);
  return (await res.json()) as T;
}

export async function fetchBytes(url: string, options: HttpOptions = {}): Promise<{ bytes: ArrayBuffer; mime: string }> {
  const res = await request(url, options);
  return { bytes: await res.arrayBuffer(), mime: res.headers.get("content-type")?.split(";")[0] ?? "" };
}

export function postJson<T>(url: string, body: unknown, options: HttpOptions = {}): Promise<T> {
  return fetchJson<T>(url, {
    ...options,
    method: "POST",
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    body: JSON.stringify(body),
  });
}

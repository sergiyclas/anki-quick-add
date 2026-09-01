export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(`HTTP ${status} from ${new URL(url).host}: ${body.slice(0, 300)}`);
    this.name = "HttpError";
  }
}

export interface HttpOptions extends RequestInit {
  timeoutMs?: number;
}

async function request(url: string, { timeoutMs = 15_000, signal, ...init }: HttpOptions): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const res = await fetch(url, { ...init, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
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

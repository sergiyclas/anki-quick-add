// The Translator API is only exposed to documents, never to workers, so every call to it happens here.

const pool = new Map<string, Promise<Translator>>();
const key = (from: string, to: string) => `${from}|${to}`;

export async function availability(from: string, to: string): Promise<AIAvailability> {
  if (!("Translator" in self)) return "unavailable";
  try {
    return await Translator.availability({ sourceLanguage: from, targetLanguage: to });
  } catch {
    return "unavailable";
  }
}

// create() needs a user gesture while the pack is still downloadable, and this document never has one:
// only an already downloaded pair is opened here. The download itself runs on the options page.
async function translator(from: string, to: string): Promise<Translator> {
  const id = key(from, to);
  const existing = pool.get(id);
  if (existing) return existing;
  const created = (async () => {
    if ((await availability(from, to)) !== "available") throw new Error(`No offline translator for ${from} to ${to}`);
    return Translator.create({ sourceLanguage: from, targetLanguage: to });
  })();
  pool.set(id, created);
  created.catch(() => pool.delete(id));
  return created;
}

export async function translate(text: string, from: string, to: string): Promise<string> {
  return (await translator(from, to)).translate(text);
}

export function releaseAll(): void {
  for (const [id, pending] of pool) {
    void pending.then(
      (t) => t.destroy(),
      () => undefined,
    );
    pool.delete(id);
  }
}

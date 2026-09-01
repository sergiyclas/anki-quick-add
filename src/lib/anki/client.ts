import type { AnkiNote, CardTemplate, ModelTemplates, NoteInfo, NoteUpdate } from "./types";

export type AnkiErrorCode = "unreachable" | "api";

export class AnkiError extends Error {
  constructor(
    public readonly code: AnkiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AnkiError";
  }
}

interface Envelope<T> {
  result: T;
  error: string | null;
}

export class AnkiClient {
  constructor(
    private readonly url: string,
    private readonly timeoutMs = 10_000,
  ) {}

  async invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: "POST",
        body: JSON.stringify({ action, version: 6, params }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      throw new AnkiError("unreachable", e instanceof Error ? e.message : String(e));
    }
    const json = (await res.json()) as Envelope<T>;
    if (json.error) throw new AnkiError("api", json.error);
    return json.result;
  }

  version(): Promise<number> {
    return this.invoke("version");
  }

  deckNames(): Promise<string[]> {
    return this.invoke("deckNames");
  }

  createDeck(deck: string): Promise<number> {
    return this.invoke("createDeck", { deck });
  }

  modelNames(): Promise<string[]> {
    return this.invoke("modelNames");
  }

  modelFieldNames(modelName: string): Promise<string[]> {
    return this.invoke("modelFieldNames", { modelName });
  }

  modelTemplates(modelName: string): Promise<ModelTemplates> {
    return this.invoke("modelTemplates", { modelName });
  }

  async modelStyling(modelName: string): Promise<string> {
    const { css } = await this.invoke<{ css: string }>("modelStyling", { modelName });
    return css;
  }

  createModel(modelName: string, inOrderFields: string[], cardTemplates: CardTemplate[], css: string): Promise<unknown> {
    return this.invoke("createModel", { modelName, inOrderFields, cardTemplates, css, isCloze: false });
  }

  findNotes(query: string): Promise<number[]> {
    return this.invoke("findNotes", { query });
  }

  notesInfo(notes: number[]): Promise<NoteInfo[]> {
    return this.invoke("notesInfo", { notes });
  }

  addNote(note: AnkiNote): Promise<number> {
    return this.invoke("addNote", { note });
  }

  updateNoteFields(note: NoteUpdate): Promise<void> {
    return this.invoke("updateNoteFields", { note });
  }

  getTags(): Promise<string[]> {
    return this.invoke("getTags");
  }
}

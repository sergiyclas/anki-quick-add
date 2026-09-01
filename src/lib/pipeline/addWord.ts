import { ensureBuiltinModel } from "../anki/builtinModel";
import { AnkiClient, AnkiError } from "../anki/client";
import { buildDedupeQuery } from "../anki/search";
import { buildSystemPrompt, buildUserMessage } from "../generation/prompt";
import { buildCardSchema } from "../generation/schema";
import type { CardData } from "../generation/types";
import { normalizeCardData, validateAgainstSchema } from "../generation/validate";
import { languageByCode } from "../languages";
import { resolveAudio } from "../media/audio";
import type { MediaResult } from "../media/types";
import { resolveImage } from "../media/wikiImage";
import { buildNote, buildUpdate } from "../note/builder";
import { type FieldMapping, resolveDefaultMapping } from "../note/mapping";
import { buildTags } from "../note/tags";
import { getAdapter } from "../providers/registry";
import { ProviderError } from "../providers/types";
import { type ApiKeys, BUILTIN_MODEL_NAME, type DuplicatePolicy, type Settings } from "../settings/schema";
import { getCache, loadKeys, loadMapping, loadSettings, setCache } from "../settings/storage";
import { normalizeWord } from "../text";
import { pushHistory } from "../history";
import { PipelineError } from "./errors";

export interface AddRequest {
  word: string;
  context?: string;
  deck?: string;
  tags?: string[];
  hint?: string;
}

export interface AddSummary {
  translation: string;
  transcription?: string;
  audio: boolean;
  image: boolean;
}

export type AddResult =
  | { status: "added" | "updated"; word: string; noteId: number; summary: AddSummary; warnings: string[] }
  | { status: "duplicate"; word: string; noteId: number }
  | { status: "error"; word: string; step: PipelineError["step"]; message: string; action?: PipelineError["action"]; detail?: string };

export type PrepareFailure = Extract<AddResult, { status: "duplicate" | "error" }>;

// Everything the pipeline produced before writing to Anki. JSON-serialisable so the editor can hold it in session storage.
export interface Prepared {
  word: string;
  context?: string;
  deck: string;
  tags: string[];
  modelName: string;
  card: CardData;
  media: MediaResult[];
  warnings: string[];
  policy: DuplicatePolicy;
  existingNoteId?: number;
}

export interface CommitOverrides {
  card?: Partial<CardData>;
  deck?: string;
  tags?: string[];
  dropAudio?: boolean;
  dropImage?: boolean;
}

function providerKey(keys: ApiKeys, settings: Settings): string {
  const id = settings.provider;
  if (id === "compat") return keys.compat?.[safeHost(settings.providers.compat.baseUrl ?? "")] ?? "";
  return keys[id] ?? "";
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

async function modelFields(client: AnkiClient, modelName: string): Promise<string[]> {
  const cached = await getCache<string[]>(`modelFields:${modelName}`);
  if (cached) return cached.items;
  const fields = await client.modelFieldNames(modelName);
  await setCache(`modelFields:${modelName}`, fields);
  return fields;
}

async function resolveMapping(modelName: string, fields: string[]): Promise<FieldMapping> {
  const mapping = (await loadMapping(modelName)) ?? resolveDefaultMapping(modelName, fields);
  if (!mapping) throw new PipelineError("mapping", `No field mapping configured for note type "${modelName}"`, "openOptions");
  return mapping;
}

function toError(word: string, e: unknown): PrepareFailure {
  if (e instanceof PipelineError) {
    return { status: "error", word, step: e.step, message: e.message, action: e.action, detail: e.detail };
  }
  if (e instanceof AnkiError) {
    return e.code === "unreachable"
      ? { status: "error", word, step: "anki", message: "Anki is not running or AnkiConnect is not installed", action: "startAnki", detail: e.message }
      : { status: "error", word, step: "write", message: `AnkiConnect: ${e.message}` };
  }
  if (e instanceof ProviderError) {
    return { status: "error", word, step: "generate", message: e.message, action: e.code === "auth" ? "openOptions" : undefined };
  }
  return { status: "error", word, step: "generate", message: e instanceof Error ? e.message : String(e) };
}

// Steps 1-6: normalise, check config, dedupe, generate, fetch media. Does not write to Anki.
export async function prepare(request: AddRequest): Promise<Prepared | PrepareFailure> {
  let word = request.word.trim();
  try {
    const [settings, keys] = await Promise.all([loadSettings(), loadKeys()]);
    word = normalizeWord(request.word, !languageByCode(settings.languages.source).keepCase);
    if (!word) throw new PipelineError("input", "Nothing to add");

    const key = providerKey(keys, settings);
    const providerCfg = settings.providers[settings.provider];
    if (!key && settings.provider !== "compat") throw new PipelineError("config", "API key is not set", "openOptions");
    if (!providerCfg.model) throw new PipelineError("config", "No model selected", "openOptions");

    const client = new AnkiClient(settings.anki.url);
    const deck = request.deck ?? settings.anki.deck;
    const modelName = settings.anki.modelName;
    if (modelName === BUILTIN_MODEL_NAME) await ensureBuiltinModel(client);
    const fields = await modelFields(client, modelName);
    const mapping = await resolveMapping(modelName, fields);

    const policy = settings.anki.duplicatePolicy;
    const existingIds = await client.findNotes(
      buildDedupeQuery(mapping.dedupeField, word, settings.anki.dedupeScope === "deck" ? deck : undefined),
    );
    const existingNoteId = existingIds[0];
    if (existingNoteId !== undefined && policy === "skip") return { status: "duplicate", word, noteId: existingNoteId };

    const schema = buildCardSchema(settings.generation, settings.media.image.enabled);
    const [generated, audio] = await Promise.all([
      getAdapter(settings.provider).generate(
        { system: buildSystemPrompt(settings), user: buildUserMessage(word, request.context, request.hint), schema, schemaName: "anki_card", maxTokens: 2048 },
        providerCfg,
        key,
      ),
      resolveAudio(word, settings).catch(() => null),
    ]);

    const problems = validateAgainstSchema(schema, generated.json);
    if (problems.length) {
      throw new PipelineError("validate", `Model output did not match the schema: ${problems[0]}`, undefined, generated.raw.slice(0, 500));
    }
    const card = normalizeCardData(generated.json as Record<string, unknown>, word, settings.generation, request.context);
    const image = await resolveImage(word, card.imageQuery ?? word, settings).catch(() => null);

    const warnings: string[] = [];
    if (settings.media.audio.enabled && !audio) warnings.push("no audio");
    if (settings.media.image.enabled && !image) warnings.push("no image");

    return {
      word,
      context: request.context,
      deck,
      tags: request.tags ?? [],
      modelName,
      card,
      media: [audio, image].filter((m): m is MediaResult => m !== null),
      warnings,
      policy,
      existingNoteId: policy === "update" ? existingNoteId : undefined,
    };
  } catch (e) {
    return toError(word, e);
  }
}

// Steps 7-8: build the note from prepared data (plus edits) and write it to Anki.
export async function commit(prepared: Prepared, overrides: CommitOverrides = {}): Promise<AddResult> {
  const { word } = prepared;
  try {
    const settings = await loadSettings();
    const client = new AnkiClient(settings.anki.url);
    const fields = await modelFields(client, prepared.modelName);
    const mapping = await resolveMapping(prepared.modelName, fields);

    const card: CardData = { ...prepared.card, ...overrides.card };
    const media = prepared.media.filter((m) => !(m.kind === "audio" && overrides.dropAudio) && !(m.kind === "image" && overrides.dropImage));
    const deck = overrides.deck ?? prepared.deck;
    const note = buildNote(card, media, mapping, {
      deck,
      tags: buildTags(settings, overrides.tags ?? prepared.tags),
      allowDuplicate: prepared.policy === "add",
      duplicateScope: settings.anki.dedupeScope,
      production: settings.anki.production,
    });
    const missing = Object.keys(note.fields).filter((f) => !fields.includes(f));
    if (missing.length) throw new PipelineError("mapping", `Note type "${prepared.modelName}" has no field "${missing[0]}"`, "openOptions");

    const summary: AddSummary = {
      translation: card.translations.join(", "),
      transcription: card.transcription,
      audio: media.some((m) => m.kind === "audio"),
      image: media.some((m) => m.kind === "image"),
    };

    if (prepared.existingNoteId !== undefined) {
      const [existing] = await client.notesInfo([prepared.existingNoteId]);
      if (existing) {
        const update = buildUpdate(existing, note);
        if (update) await client.updateNoteFields(update);
        const result: AddResult = { status: "updated", word, noteId: existing.noteId, summary, warnings: prepared.warnings };
        await pushHistory(result, deck, settings.ui.historySize);
        return result;
      }
    }
    const noteId = await client.addNote(note);
    const result: AddResult = { status: "added", word, noteId, summary, warnings: prepared.warnings };
    await pushHistory(result, deck, settings.ui.historySize);
    return result;
  } catch (e) {
    return toError(word, e);
  }
}

export async function addWord(request: AddRequest): Promise<AddResult> {
  const prepared = await prepare(request);
  return "status" in prepared ? prepared : commit(prepared);
}

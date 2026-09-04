import { HttpError, fetchJson } from "../../http";
import type { ProviderAdapter } from "../types";
import { pickSense } from "../../sense/match";
import { translateText } from "../../translate/engine";
import { gtxLookup } from "./gtx";
import { tatoebaExamples } from "./tatoeba";

// "Free" provider: no language model and no API key. The card is assembled from public sources:
// Google Translate's dictionary data (translations, part of speech, synonyms, definitions, examples),
// dictionaryapi.dev for English (IPA, definitions, examples, synonyms) and Tatoeba for example sentences
// with translations. Fields a language model would write (grammar notes, mnemonics) stay empty.

interface DictionaryEntry {
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings?: { partOfSpeech?: string; definitions?: { definition?: string; example?: string; synonyms?: string[] }[]; synonyms?: string[] }[];
}

interface EnglishFacts {
  ipa?: string;
  partOfSpeech?: string;
  definition?: string;
  examples: string[];
  synonyms: string[];
}

export async function englishFacts(word: string): Promise<EnglishFacts | null> {
  let entries: DictionaryEntry[];
  try {
    entries = await fetchJson<DictionaryEntry[]>(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeoutMs: 8_000 });
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
  const facts: EnglishFacts = { examples: [], synonyms: [] };
  for (const entry of entries) {
    facts.ipa ??= entry.phonetic ?? entry.phonetics?.find((p) => p.text)?.text;
    for (const meaning of entry.meanings ?? []) {
      facts.partOfSpeech ??= meaning.partOfSpeech;
      facts.synonyms.push(...(meaning.synonyms ?? []));
      for (const d of meaning.definitions ?? []) {
        facts.definition ??= d.definition;
        if (d.example) facts.examples.push(d.example);
        facts.synonyms.push(...(d.synonyms ?? []));
      }
    }
  }
  return facts;
}

const dedupe = (items: string[]) => [...new Set(items.map((s) => s.trim()).filter(Boolean))];
const capitalizeSentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const withFullStop = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);

export const free: ProviderAdapter = {
  id: "free",

  hostPatterns: () => ["https://translate.googleapis.com/*", "https://api.dictionaryapi.dev/*", "https://tatoeba.org/*"],

  async listModels() {
    return [];
  },

  async generate(req) {
    const { word, source, target, generation: g } = req;
    const english = source === "en" ? englishFacts(word).catch(() => null) : Promise.resolve(null);
    const [gtx, facts] = await Promise.all([gtxLookup(word, source, target), english]);

    // With a sentence at hand, translate it once: it decides which sense is meant, and it doubles as the
    // translation of the context example below.
    let contextTranslation: string | undefined;
    let ordered = [...gtx.alternatives.flatMap((a) => a.terms), gtx.translation];
    if (req.context && req.senseFromContext && gtx.senses.length > 1) {
      const sentence = await translateText(req.context, source, target).catch(() => null);
      if (sentence?.text) {
        contextTranslation = sentence.text;
        const pick = pickSense(gtx.senses, sentence.text, target);
        if (pick) ordered = [pick.term, ...ordered];
      }
    }
    const translations = dedupe(ordered).slice(0, g.translationsCount);
    const partOfSpeech = gtx.alternatives[0]?.partOfSpeech ?? facts?.partOfSpeech ?? "";
    const definition = facts?.definition ?? gtx.definitions[0]?.text ?? "";
    const synonyms = dedupe([...gtx.synonyms, ...(facts?.synonyms ?? [])]).filter((s) => s.toLowerCase() !== word.toLowerCase()).slice(0, g.synonymsCount);

    // Examples: the sentence the word was selected in first, then Tatoeba (with translations when the pair
    // has them), then Google's and the dictionary's examples.
    const examples: { text: string; translation?: string }[] = [];
    if (req.context) examples.push({ text: req.context, translation: contextTranslation });
    if (examples.length < g.examplesCount) {
      const fromTatoeba = await tatoebaExamples(word, source, target, g.examplesCount - examples.length).catch(() => []);
      examples.push(...fromTatoeba);
    }
    for (const text of [...gtx.examples, ...(facts?.examples ?? [])]) {
      if (examples.length >= g.examplesCount) break;
      const cleaned = withFullStop(capitalizeSentence(text.trim()));
      if (!examples.some((e) => e.text.toLowerCase() === cleaned.toLowerCase())) examples.push({ text: cleaned });
    }

    // The schema is strict: example translations are only allowed (and then required) when enabled.
    const shapedExamples = examples
      .slice(0, g.examplesCount)
      .map((e) => (g.exampleTranslations ? { text: e.text, translation: e.translation ?? "" } : { text: e.text }));
    const json: Record<string, unknown> = { translations, examples: shapedExamples };
    const keys = (req.schema.type === "object" ? req.schema.required : []) as string[];
    if (keys.includes("transcription")) json["transcription"] = facts?.ipa ?? "";
    if (keys.includes("partOfSpeech")) json["partOfSpeech"] = partOfSpeech;
    if (keys.includes("definition")) json["definition"] = definition;
    if (keys.includes("synonyms")) json["synonyms"] = synonyms;
    if (keys.includes("grammar")) json["grammar"] = "";
    if (keys.includes("mnemonic")) json["mnemonic"] = "";
    if (keys.includes("etymology")) json["etymology"] = "";
    if (keys.includes("imageQuery")) json["imageQuery"] = word;
    return { json, raw: JSON.stringify(json), model: "free" };
  },
};

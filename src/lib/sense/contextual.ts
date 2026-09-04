// "bat" on a baseball page should say битка, not кажан: the sentence around the word decides which
// dictionary sense is meant.

import { gtxLookup } from "../providers/free/gtx";
import { getCache, setCache } from "../settings/storage";
import { type TranslateEngine, translateText } from "../translate/engine";
import { type Sense, contextWindow, diffTokens, pickSense, removeWord, stemEquivalent } from "./match";

export interface ContextSense {
  translation: string; // what to show as the headline
  base: string; // the sense-blind translation, i.e. what the extension said before
  contextual?: string; // set only when the sentence points at a different sense
  confidence: "exact" | "stem" | "diff" | "none";
  form: "lemma" | "inflected"; // "diff" results are the form used in the sentence, not a dictionary entry
  alternatives: string[];
  sentence: string;
  engine: TranslateEngine;
}

const CACHE_LIMIT = 200;
type SenseCache = Record<string, { senses: Sense[]; at: number }>;

const key = (word: string, from: string, to: string) => `${from}|${to}|${word.toLowerCase()}`;

async function cachedSenses(word: string, from: string, to: string): Promise<Sense[] | undefined> {
  return (await getCache<SenseCache>("senses"))?.items?.[key(word, from, to)]?.senses;
}

async function rememberSenses(word: string, from: string, to: string, senses: Sense[]): Promise<void> {
  const all = (await getCache<SenseCache>("senses"))?.items ?? {};
  const entries = Object.entries({ ...all, [key(word, from, to)]: { senses, at: Date.now() } })
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, CACHE_LIMIT);
  await setCache("senses", Object.fromEntries(entries));
}

/**
 * Looks up the candidates for a word and asks the sentence which one is meant. Any failure degrades to
 * the plain translation, so the caller can always show something.
 */
export async function contextualTranslate(request: {
  word: string;
  sentence: string;
  source: string;
  target: string;
}): Promise<ContextSense> {
  const { word, sentence, source, target } = request;

  let base = "";
  let senses: Sense[] = [];
  try {
    const gtx = await gtxLookup(word, source, target);
    base = gtx.translation;
    senses = gtx.senses;
    if (senses.length) await rememberSenses(word, source, target, senses);
  } catch {
    // Offline, or the endpoint refused: fall back to a plain translation plus whatever we saw before.
    senses = (await cachedSenses(word, source, target)) ?? [];
  }

  const plain = base ? { text: base, engine: "gtx" as TranslateEngine } : await translateText(word, source, target);
  base = base || plain.text;
  const alternatives = senses.map((s) => s.term).filter((term) => term !== base);
  const result: ContextSense = { translation: base, base, confidence: "none", form: "lemma", alternatives: alternatives.slice(0, 5), sentence, engine: plain.engine };
  if (!sentence) return result;

  const translated = await translateText(sentence, source, target).catch(() => null);
  if (!translated?.text) return result;
  result.engine = translated.engine;

  const pick = senses.length > 1 ? pickSense(senses, translated.text, target) : null;
  if (pick) {
    result.confidence = pick.match;
    // When the common sense is also the one used here, there is nothing to correct.
    if (stemEquivalent(pick.term, base, target)) return result;
    result.translation = pick.term;
    result.contextual = pick.term;
    return result;
  }

  // The dictionary has no candidate that fits - and often it simply has none at all, as for the verb
  // form "facing". Ask what the translation of a short window loses when the word is taken out of it.
  const window = contextWindow(sentence, word);
  if (!window) return result;
  const without = removeWord(window, word);
  if (!without || without === window) return result;
  const [full, rest] = await Promise.all([
    translateText(window, source, target).catch(() => null),
    translateText(without, source, target).catch(() => null),
  ]);
  if (!full?.text || !rest?.text) return result;
  const missing = diffTokens(full.text, rest.text, target);
  if (!missing.length) return result;
  // If any leftover is the usual translation, the difference is that word plus noise, not a new sense.
  if (missing.some((token) => stemEquivalent(token, base, target))) return result;
  const inContext = missing.join(" ");
  result.translation = inContext;
  result.contextual = inContext;
  result.confidence = "diff";
  result.form = "inflected";
  return result;
}

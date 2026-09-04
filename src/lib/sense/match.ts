// Picking the sense a word carries in a sentence, without a language model: the sentence is translated
// as a whole (a translator gets the sense right in context), and the dictionary candidate that shows up
// in that translation wins. Pure module - no chrome, no DOM, so it can be unit-tested directly.

export interface Sense {
  term: string;
  partOfSpeech?: string;
  backTranslations?: string[];
  score?: number;
}

export type MatchKind = "exact" | "stem";

export interface SensePick {
  term: string;
  match: MatchKind;
}

// Targets where a word changes its ending (and sometimes its stem vowel) far too much for equality.
const INFLECTED = new Set(["uk", "ru", "be", "pl", "cs", "sk", "bg", "hr", "sr", "sl", "lt", "lv", "et", "fi", "hu", "tr"]);
// Ukrainian and its neighbours alternate these in closed syllables: стіл -> столу, ніч -> ночі.
const FOLDS: [RegExp, string][] = [
  [/і/g, "о"],
  [/і/g, "е"],
  [/о/g, "і"],
  [/е/g, "і"],
];

export function normalize(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’ʼ`']/g, "ʼ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}ʼ]+$/gu, "");
}

export function tokenize(text: string): string[] {
  return (text.normalize("NFC").toLowerCase().match(/[\p{L}\p{N}’ʼ'-]+/gu) ?? []).map(normalize).filter(Boolean);
}

export function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

/** Levenshtein distance with an early exit: true when the distance is at most `max`. */
export function levenshteinAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      current.push(value);
      if (value < best) best = value;
    }
    if (best > max) return false;
    previous = current;
  }
  return previous[b.length]! <= max;
}

function prefixBudget(shortest: number): number {
  if (shortest <= 4) return 1;
  if (shortest <= 6) return 2;
  if (shortest <= 9) return 3;
  return 4;
}

function sharesStem(a: string, b: string): boolean {
  const shortest = Math.min(a.length, b.length);
  const need = Math.max(3, shortest - prefixBudget(shortest));
  if (commonPrefixLength(a, b) >= need) return true;
  return commonPrefixLength(a, b) >= 2 && levenshteinAtMost(a, b, shortest <= 5 ? 1 : 2);
}

/**
 * Same word in a different form? Deliberately strict: short words must match exactly, because a loose
 * prefix rule would happily call "рак" and "ракета" the same word.
 */
export function stemEquivalent(a: string, b: string, target = ""): boolean {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shortest = Math.min(left.length, right.length);
  if (shortest <= 3) return false;
  if (Math.abs(left.length - right.length) > 3) return false;
  if (sharesStem(left, right)) return true;
  if (!INFLECTED.has(target)) return false;
  return FOLDS.some(([from, to]) => sharesStem(left.replace(from, to), right.replace(from, to)));
}

function findInTokens(term: string, tokens: string[], target: string): MatchKind | null {
  const words = tokenize(term);
  if (!words.length) return null;
  let weakest: MatchKind = "exact";
  for (const word of words) {
    if (tokens.includes(word)) continue;
    // Stem matching needs enough letters to be meaningful.
    if (word.length >= 4 && tokens.some((t) => stemEquivalent(word, t, target))) {
      weakest = "stem";
      continue;
    }
    return null;
  }
  return weakest;
}

/**
 * The first candidate (they arrive in frequency order) that appears in the translated sentence.
 * An exact hit always beats a stem hit; `null` means the sentence tells us nothing.
 */
export function pickSense(senses: Sense[], sentenceTranslation: string, target = ""): SensePick | null {
  const tokens = tokenize(sentenceTranslation);
  if (!tokens.length) return null;
  let fallback: SensePick | null = null;
  for (const sense of senses) {
    const match = findInTokens(sense.term, tokens, target);
    if (match === "exact") return { term: sense.term, match };
    if (match === "stem" && !fallback) fallback = { term: sense.term, match };
  }
  return fallback;
}

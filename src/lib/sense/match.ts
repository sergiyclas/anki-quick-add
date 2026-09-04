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

// Two words on each side of the selection, measured rather than guessed. A whole sentence is useless
// here (the translator rebuilds the missing meaning from the rest and both translations come out the
// same), and a single neighbour is too little: "run for office" then falls back to the literal "бігти".
const WINDOW_RADIUS = 2;

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
  const inflected = INFLECTED.has(target);
  // Short words get one narrow exception: a plain ending on top of the whole word ("бас" -> "басу").
  // Anything longer than that is a different word ("рак" is not "ракета").
  if (shortest <= 3) {
    const shortMatch = (x: string, y: string) => commonPrefixLength(x, y) === Math.min(x.length, y.length) && Math.abs(x.length - y.length) <= 2;
    if (shortMatch(left, right)) return true;
    return inflected && FOLDS.some(([from, to]) => shortMatch(left.replace(from, to), right.replace(from, to)));
  }
  if (Math.abs(left.length - right.length) > 3) return false;
  if (sharesStem(left, right)) return true;
  if (!inflected) return false;
  return FOLDS.some(([from, to]) => sharesStem(left.replace(from, to), right.replace(from, to)));
}

/**
 * How well a candidate shows up in the sentence: `distance` is how far its form is from the word
 * actually used there, so "бас" beats "басовий" when the sentence says "басу".
 */
function findInTokens(term: string, tokens: string[], target: string): { kind: MatchKind; distance: number } | null {
  const words = tokenize(term);
  if (!words.length) return null;
  let kind: MatchKind = "exact";
  let distance = 0;
  for (const word of words) {
    if (tokens.includes(word)) continue;
    // Stem matching needs enough letters to be meaningful, except for short words that only took an ending.
    const matches = tokens.filter((t) => (word.length >= 4 || t.startsWith(word)) && stemEquivalent(word, t, target));
    if (!matches.length) return null;
    kind = "stem";
    distance += Math.min(...matches.map((t) => Math.abs(t.length - word.length)));
  }
  return { kind, distance };
}

/** The words around the selection, at most `radius` on each side. */
export function contextWindow(sentence: string, word: string, radius = WINDOW_RADIUS): string {
  const words = sentence.split(/\s+/).filter(Boolean);
  const needle = normalize(word);
  const at = words.findIndex((w) => normalize(w) === needle);
  if (at < 0) return "";
  // Only safe when the word appears once: otherwise removing it is ambiguous.
  if (words.filter((w) => normalize(w) === needle).length > 1) return "";
  return words.slice(Math.max(0, at - radius), at + radius + 1).join(" ");
}

export function removeWord(window: string, word: string): string {
  const needle = normalize(word);
  return window
    .split(/\s+/)
    .filter((w) => normalize(w) !== needle)
    .join(" ");
}

/**
 * What the translation loses when the word is taken out of its window. Returns nothing when the
 * difference is too noisy to be about that one word.
 */
export function diffTokens(withWord: string, withoutWord: string, target = ""): string[] {
  const left = tokenize(withoutWord);
  const extra: string[] = [];
  for (const token of tokenize(withWord)) {
    const exact = left.indexOf(token);
    if (exact >= 0) {
      left.splice(exact, 1);
      continue;
    }
    const similar = left.findIndex((other) => stemEquivalent(token, other, target));
    if (similar >= 0) {
      left.splice(similar, 1);
      continue;
    }
    extra.push(token);
  }
  // Three letters or fewer is a preposition far more often than a word worth showing: without this,
  // "flu shot" comes back as "щеплення від".
  const words = extra.filter((t) => t.length >= 4);
  return words.length && words.length <= 2 ? words : [];
}

/**
 * The first candidate (they arrive in frequency order) that appears in the translated sentence.
 * An exact hit always beats a stem hit; `null` means the sentence tells us nothing.
 */
export function pickSense(senses: Sense[], sentenceTranslation: string, target = ""): SensePick | null {
  const tokens = tokenize(sentenceTranslation);
  if (!tokens.length) return null;
  let best: (SensePick & { distance: number }) | null = null;
  for (const sense of senses) {
    const match = findInTokens(sense.term, tokens, target);
    if (!match) continue;
    if (match.kind === "exact") return { term: sense.term, match: "exact" };
    if (!best || match.distance < best.distance) best = { term: sense.term, match: "stem", distance: match.distance };
  }
  return best ? { term: best.term, match: best.match } : null;
}

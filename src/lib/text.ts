const EDGE_PUNCTUATION = /^[\s!?.,;:"'()«»“”‘’…]+|[\s!?.,;:"'()«»“”‘’…]+$/gu;

// Trims surrounding punctuation/whitespace and lowercases a lone leading capital,
// so "Hello", "hello!" and «Hello» all become the same headword. Acronyms and mixed case stay as typed.
export function normalizeWord(raw: string, lowercaseLoneCapital = true): string {
  const word = raw.replace(EDGE_PUNCTUATION, "").replace(/\s+/g, " ");
  if (!lowercaseLoneCapital) return word;
  const rest = word.slice(1);
  return rest === rest.toLowerCase() ? word.charAt(0).toLowerCase() + rest : word;
}

export function slug(word: string): string {
  return word
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (const ch of input) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").slice(-6);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

// Escapes characters that are special inside a quoted Anki search term.
export function escapeAnkiSearch(s: string): string {
  return s.replace(/[\\"*_]/g, (c) => "\\" + c);
}

const SENTENCE_END = /[.!?…]+["'»”’)]*(?=\s|$)/g;

// Returns the sentence of `block` that contains `selection` (first occurrence), capped to `maxLen` characters
// around the selection. Empty string when the selection is not found.
export function extractSentence(block: string, selection: string, maxLen = 300): string {
  const text = block.replace(/\s+/g, " ").trim();
  const needle = selection.replace(/\s+/g, " ").trim();
  if (!text || !needle) return "";
  let at = text.indexOf(needle);
  if (at < 0) at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return "";

  let start = 0;
  let end = text.length;
  for (const m of text.matchAll(SENTENCE_END)) {
    const boundary = m.index + m[0].length;
    if (boundary <= at) start = boundary;
    else if (boundary >= at + needle.length) {
      end = boundary;
      break;
    }
  }
  let sentence = text.slice(start, end).trim();
  if (sentence.length > maxLen) {
    const local = sentence.toLowerCase().indexOf(needle.toLowerCase());
    const from = Math.max(0, Math.min(local - Math.floor(maxLen / 2), sentence.length - maxLen));
    const cut = sentence.slice(from, from + maxLen).trim();
    sentence = `${from > 0 ? "…" : ""}${cut}${from + maxLen < sentence.length ? "…" : ""}`;
  }
  return sentence;
}

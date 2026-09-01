import { escapeAnkiSearch } from "../text";

export function buildDedupeQuery(field: string, word: string, deck?: string): string {
  const term = `"${field}:${escapeAnkiSearch(word)}"`;
  return deck ? `${term} "deck:${escapeAnkiSearch(deck)}"` : term;
}

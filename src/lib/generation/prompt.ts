import { languageByCode } from "../languages";
import { tierAtLeast } from "../license";
import type { Settings } from "../settings/schema";
import { QUALITY_RULES } from "./qualityRules";

export function buildSystemPrompt(settings: Settings): string {
  const g = settings.generation;
  const source = languageByCode(settings.languages.source);
  const target = languageByCode(settings.languages.target);
  const ipaHint = source.ipaHint ? ` (${source.ipaHint})` : "";
  const exampleTranslation = g.exampleTranslations ? `, each with a ${target.name} translation` : "";

  const lines = [
    `You generate data for an Anki vocabulary card for a ${target.name} speaker learning ${source.name}.`,
    `Input: a ${source.name} word or short phrase, optionally with the sentence it appeared in ("Context").`,
    `Use the Context to choose the intended sense; otherwise use the most common sense.`,
    `Return JSON with:`,
    `- translations: the ${g.translationsCount} most common ${target.name} translations of that sense (for a phrase, one natural translation)`,
  ];
  if (g.transcription) lines.push(`- transcription: IPA of the headword${ipaHint}, wrapped in slashes`);
  if (g.partOfSpeech) lines.push(`- partOfSpeech: noun / verb / adjective / adverb / phrase / ... (in English)`);
  if (g.definition) lines.push(`- definition: a short ${source.name} definition, wording appropriate for CEFR ${g.level}`);
  if (g.synonyms) lines.push(`- synonyms: up to ${g.synonymsCount} ${source.name} synonyms or near-synonyms for that sense; [] if none`);
  lines.push(
    `- examples: ${g.examplesCount} short natural ${source.name} sentences at CEFR ${g.level}, varied contexts${exampleTranslation}. If a Context sentence is given, use it (lightly corrected) as the first example.`,
  );
  if (g.grammar) {
    lines.push(
      `- grammar: brief notes a learner needs for this word in ${source.name} (gender/plural, irregular forms, aspect pair, governed case/preposition, countability); "" if nothing notable`,
    );
  }
  const pro = tierAtLeast(settings.license.tier, "pro");
  if (pro && g.mnemonic) {
    lines.push(`- mnemonic: one vivid, concrete memory hook that links the sound or spelling of the word to its meaning for a ${target.name} speaker (max 2 sentences)`);
  }
  if (pro && g.etymology) lines.push(`- etymology: where the word comes from, in one sentence`);
  if (settings.media.image.enabled) {
    lines.push(`- imageQuery: the Wikipedia article title or short search phrase that best depicts this sense`);
  }

  const targetRules = QUALITY_RULES[target.code];
  if (targetRules) lines.push("", targetRules);
  const sourceRules = source.code !== target.code ? QUALITY_RULES[source.code] : undefined;
  if (sourceRules) lines.push("", sourceRules);
  if (g.extraInstructions.trim()) lines.push("", g.extraInstructions.trim());

  lines.push("", "Keep everything concise. Do not add fields beyond the schema.");
  return lines.join("\n");
}

export function buildUserMessage(word: string, context?: string, hint?: string): string {
  const lines = [`Word: ${word}`];
  if (context) lines.push(`Context: ${context}`);
  if (hint) lines.push(`Hint from the learner: ${hint}`);
  return lines.join("\n");
}

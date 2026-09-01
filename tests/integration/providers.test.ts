// Live provider checks. Opt in with AQA_LIVE=1; each block also needs its key in the environment
// (GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY). Keys are never printed.
import { describe, expect, test } from "vitest";
import { buildSystemPrompt, buildUserMessage } from "../../src/lib/generation/prompt";
import { buildCardSchema } from "../../src/lib/generation/schema";
import { normalizeCardData, validateAgainstSchema } from "../../src/lib/generation/validate";
import { getAdapter } from "../../src/lib/providers/registry";
import { DEFAULT_SETTINGS, type ProviderId } from "../../src/lib/settings/schema";

declare const process: { env: Record<string, string | undefined> };

const cases: { id: ProviderId; env: string }[] = [
  { id: "gemini", env: "GEMINI_API_KEY" },
  { id: "openai", env: "OPENAI_API_KEY" },
  { id: "anthropic", env: "ANTHROPIC_API_KEY" },
];

for (const { id, env } of cases) {
  describe.skipIf(!process.env["AQA_LIVE"] || !process.env[env])(`${id} live`, () => {
    test("generates a schema-valid card for 'bat' in a baseball context", async () => {
      const override = process.env[`AQA_${id.toUpperCase()}_MODEL`];
      const settings = override
        ? { ...DEFAULT_SETTINGS, providers: { ...DEFAULT_SETTINGS.providers, [id]: { ...DEFAULT_SETTINGS.providers[id], model: override } } }
        : DEFAULT_SETTINGS;
      const schema = buildCardSchema(settings.generation, true);
      const result = await getAdapter(id).generate(
        {
          system: buildSystemPrompt(settings),
          user: buildUserMessage("bat", "He swung the bat and hit a home run."),
          schema,
          schemaName: "anki_card",
          maxTokens: 2048,
        },
        settings.providers[id],
        process.env[env]!,
      );
      expect(validateAgainstSchema(schema, result.json)).toEqual([]);
      const card = normalizeCardData(result.json as Record<string, unknown>, "bat", settings.generation);
      expect(card.translations.length).toBeGreaterThan(0);
      expect(card.examples.length).toBeGreaterThan(0);
      expect(card.imageQuery?.toLowerCase()).toContain("bat");
      console.log(`${id}/${result.model}: ${card.translations.join(", ")} | ${card.transcription} | image: ${card.imageQuery}`);
    }, 90_000);
  });
}

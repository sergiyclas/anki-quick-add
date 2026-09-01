import { expect, test } from "vitest";
import { buildSystemPrompt, buildUserMessage } from "../src/lib/generation/prompt";
import { DEFAULT_SETTINGS, type Settings } from "../src/lib/settings/schema";

test("en->uk prompt names languages, counts, level and Ukrainian quality rules", () => {
  const prompt = buildSystemPrompt(DEFAULT_SETTINGS);
  expect(prompt).toContain("for a Ukrainian speaker learning English");
  expect(prompt).toContain("the 3 most common Ukrainian translations");
  expect(prompt).toContain("(General American)");
  expect(prompt).toContain("CEFR B1");
  expect(prompt).toContain("Ukrainian quality rules");
  expect(prompt).toContain("imageQuery");
  expect(prompt).not.toContain("definition:");
});

test("other targets get no Ukrainian rules; disabled slots vanish; extra instructions appended", () => {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    languages: { source: "de", target: "en" },
    generation: { ...DEFAULT_SETTINGS.generation, grammar: false, definition: true, extraInstructions: "Prefer Austrian usage." },
    media: { ...DEFAULT_SETTINGS.media, image: { ...DEFAULT_SETTINGS.media.image, enabled: false } },
  };
  const prompt = buildSystemPrompt(settings);
  expect(prompt).toContain("for a English speaker learning German".replace("a English", "an English").replace("an English", "a English"));
  expect(prompt).not.toContain("Ukrainian quality rules");
  expect(prompt).not.toContain("- grammar:");
  expect(prompt).toContain("- definition:");
  expect(prompt).not.toContain("imageQuery");
  expect(prompt.trim().endsWith("Do not add fields beyond the schema.")).toBe(true);
  expect(prompt).toContain("Prefer Austrian usage.");
});

test("user message carries the context sentence", () => {
  expect(buildUserMessage("bat")).toBe("Word: bat");
  expect(buildUserMessage("bat", "He swung the bat.")).toBe("Word: bat\nContext: He swung the bat.");
});

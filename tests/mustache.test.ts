import { expect, test } from "vitest";
import { BUILTIN_TEMPLATES } from "../src/lib/anki/builtinModel";
import { BUILTIN_FIELDS, defaultMappingForBuiltin } from "../src/lib/note/mapping";
import { isFieldEmpty, renderTemplate, stripHtml } from "../src/lib/note/mustache";
import { samplePreviewFields } from "../src/lib/note/sample";
import { DEFAULT_SETTINGS } from "../src/lib/settings/schema";

const ctx = { card: "Card 1", deck: "Lang::English", type: "Basic", tags: ["a", "b"] };

test("fields, sections, inverted sections and specials", () => {
  const fields = { Front: "<b>hi</b>", Back: "", Hint: "h", Sound: "[sound:x.mp3]" };
  const tpl = "{{Front}}|{{#Back}}B{{/Back}}|{{^Back}}noB{{/Back}}|{{#Front}}F{{^Back}}!{{/Back}}{{/Front}}|{{text:Front}}|{{hint:Hint}}|{{Tags}}|{{Subdeck}}|{{Card}}|{{tts en_US:Front}}|{{Sound}}";
  expect(renderTemplate(tpl, { ...ctx, fields })).toBe(
    '<b>hi</b>||noB|F!|hi|<span class="hint">h</span>|a b|English|Card 1||<span class="aqa-sound" title="audio">&#128266;</span>',
  );
});

test("FrontSide and emptiness rules", () => {
  expect(renderTemplate("{{FrontSide}}<hr>{{Back}}", { ...ctx, fields: { Back: "x" }, frontSide: "Q" })).toBe("Q<hr>x");
  expect(isFieldEmpty("<br>")).toBe(true);
  expect(isFieldEmpty(" &nbsp; ")).toBe(true);
  expect(isFieldEmpty('<img src="a.png">')).toBe(false);
  expect(stripHtml("a<br>b &amp; c")).toBe("a b & c");
});

test("built-in templates reference only built-in fields and behave with the sample", () => {
  const referenced = new Set<string>();
  for (const t of BUILTIN_TEMPLATES) {
    for (const m of `${t.Front}${t.Back}`.matchAll(/\{\{[#^/]?\s*(?:[a-z]+:)?([^{}]+?)\s*\}\}/g)) referenced.add(m[1]!);
  }
  referenced.delete("FrontSide");
  for (const name of referenced) expect(BUILTIN_FIELDS).toContain(name);

  const fields = samplePreviewFields(DEFAULT_SETTINGS, defaultMappingForBuiltin());
  const [recognition, production] = BUILTIN_TEMPLATES;
  const front = renderTemplate(recognition!.Front, { ...ctx, fields });
  expect(front).toContain('<div class="word">queue</div>');
  expect(front).toContain("/kjuː/");
  const back = renderTemplate(recognition!.Back, { ...ctx, fields, frontSide: front });
  expect(back).toContain("черга");
  expect(back).toContain("Synonyms:");
  // Production card is empty (not generated) unless Reverse is set.
  expect(renderTemplate(production!.Front, { ...ctx, fields }).trim()).toBe("");
  const withReverse = samplePreviewFields({ ...DEFAULT_SETTINGS, anki: { ...DEFAULT_SETTINGS.anki, production: true } }, defaultMappingForBuiltin());
  expect(renderTemplate(production!.Front, { ...ctx, fields: withReverse })).toContain("черга");
});

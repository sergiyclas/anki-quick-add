import { beforeAll, expect, test } from "vitest";
import { extractSentence } from "../src/lib/text";

beforeAll(() => {
  (globalThis as { chrome?: unknown }).chrome = {
    i18n: { getMessage: (key: string, subs?: string[]) => `${key}${subs?.length ? `:${subs.join(",")}` : ""}` },
  };
});

test("extractSentence picks the sentence containing the selection", () => {
  const block = "Anki is a program. It makes remembering things easy! Because it's a lot more efficient than traditional study methods? Yes.";
  expect(extractSentence(block, "remembering")).toBe("It makes remembering things easy!");
  expect(extractSentence(block, "Anki")).toBe("Anki is a program.");
  expect(extractSentence(block, "Yes")).toBe("Yes.");
  expect(extractSentence(block, "REMEMBERING")).toBe("It makes remembering things easy!");
  expect(extractSentence(block, "missing")).toBe("");
});

test("extractSentence normalises whitespace and caps long sentences around the selection", () => {
  expect(extractSentence("First line.\n  Second\n line with   bat inside.\nThird.", "bat")).toBe("Second line with bat inside.");
  const long = `${"word ".repeat(100)}needle ${"tail ".repeat(100)}.`;
  const out = extractSentence(long, "needle", 120);
  expect(out.length).toBeLessThanOrEqual(122);
  expect(out).toContain("needle");
  expect(out.startsWith("…")).toBe(true);
});

test("context menu items: default deck first, other decks capped, editor last", async () => {
  const { menuItems } = await import("../src/background/contextMenu");
  const items = menuItems(["A", "My learning", "B", "C", "D"], "My learning", 2);
  expect(items.map((i) => i.id)).toEqual(["aqa_default", "aqa_sep1", "aqa_deck:A", "aqa_deck:B", "aqa_sep2", "aqa_editor"]);
  expect(items[0]!.title).toBe("ctx_default:My learning");
  expect(menuItems(["Only"], "Only", 8).map((i) => i.id)).toEqual(["aqa_default", "aqa_sep2", "aqa_editor"]);
});

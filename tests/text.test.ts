import { expect, test } from "vitest";
import { escapeAnkiSearch, escapeHtml, fnv1a, normalizeWord, slug } from "../src/lib/text";

test.each([
  ["Hello", "hello"],
  ["hello!", "hello"],
  ["  Queue.  ", "queue"],
  ["«Слово»", "слово"],
  ["“quote”", "quote"],
  ["NASA", "NASA"],
  ["iPhone", "iPhone"],
  ["New York", "New York"],
  ["take   off", "take off"],
  ["!!!", ""],
])("normalizeWord(%j) -> %j", (input, expected) => {
  expect(normalizeWord(input)).toBe(expected);
});

test("slug keeps letters of any script and caps length", () => {
  expect(slug("Haus")).toBe("haus");
  expect(slug("дякую")).toBe("дякую");
  expect(slug("take off!")).toBe("take_off");
  expect(slug("a".repeat(60))).toHaveLength(40);
});

test("fnv1a is a stable 6-hex digest", () => {
  expect(fnv1a("hello")).toMatch(/^[0-9a-f]{6}$/);
  expect(fnv1a("hello")).toBe(fnv1a("hello"));
  expect(fnv1a("hello")).not.toBe(fnv1a("hellp"));
});

test("escapes", () => {
  expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  expect(escapeAnkiSearch('a_b*c"d\\e')).toBe('a\\_b\\*c\\"d\\\\e');
});

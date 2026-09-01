import { expect, test } from "vitest";
import { splitWords } from "../src/lib/pipeline/batch";

test("splitWords splits on newlines/commas/semicolons, trims and dedupes case-insensitively", () => {
  expect(splitWords("apple\nBanana, cherry; apple\n\n  Banana ")).toEqual(["apple", "Banana", "cherry"]);
  expect(splitWords("take off, give up")).toEqual(["take off", "give up"]);
  expect(splitWords("")).toEqual([]);
});

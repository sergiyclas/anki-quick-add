import { expect, test } from "vitest";
import { parseExport } from "../src/lib/settings/exportImport";
import { DEFAULT_SETTINGS } from "../src/lib/settings/schema";

test("parseExport validates and fills defaults", () => {
  const file = parseExport(
    JSON.stringify({ app: "anki-quick-add", version: 2, settings: { anki: { deck: "X" } }, mappings: [{ modelName: "M" }], keys: { anthropic: "k" } }),
  );
  expect(file.settings.anki.deck).toBe("X");
  expect(file.settings.generation).toEqual(DEFAULT_SETTINGS.generation);
  expect(file.mappings).toEqual([{ modelName: "M" }]);
  expect(file.keys).toEqual({ anthropic: "k" });
});

test("parseExport rejects foreign or wrong-version files", () => {
  expect(() => parseExport("nope")).toThrow("Not a JSON file");
  expect(() => parseExport(JSON.stringify({ app: "other", settings: {} }))).toThrow("Not an Anki Quick Add settings file");
  expect(() => parseExport(JSON.stringify({ app: "anki-quick-add", version: 1, settings: {} }))).toThrow("Unsupported settings version 1");
});

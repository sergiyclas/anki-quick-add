import { describe, expect, it } from "vitest";
import { UI_LOCALES, formatMessage } from "../src/lib/i18n";

describe("formatMessage", () => {
  it("expands named placeholders through their content", () => {
    const entry = { message: "Added: $WORD$ – $TRANSLATION$", placeholders: { WORD: { content: "$1" }, TRANSLATION: { content: "$2" } } };
    expect(formatMessage(entry, ["harbor", "гавань"])).toBe("Added: harbor – гавань");
  });

  it("matches placeholder names case-insensitively, as Chrome does", () => {
    const entry = { message: "Adding $Word$…", placeholders: { word: { content: "$1" } } };
    expect(formatMessage(entry, "queue")).toBe("Adding queue…");
  });

  it("substitutes positional $n and unescapes $$", () => {
    expect(formatMessage({ message: "$1 costs $$5" }, ["Coffee"])).toBe("Coffee costs $5");
  });

  it("drops substitutions that were not supplied", () => {
    expect(formatMessage({ message: "[$1] $2" }, ["only"])).toBe("[only] ");
  });

  it("leaves unknown named placeholders untouched", () => {
    expect(formatMessage({ message: "Hi $NAME$" })).toBe("Hi $NAME$");
  });
});

describe("UI_LOCALES", () => {
  it("lists every bundled locale exactly once", () => {
    const codes = UI_LOCALES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining(["en", "uk", "de", "fr", "es", "it", "pl", "pt_BR", "nl", "tr", "ja", "zh_CN"]));
    expect(codes).toHaveLength(12);
  });
});

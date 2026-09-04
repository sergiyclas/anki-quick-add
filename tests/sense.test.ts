import { describe, expect, it } from "vitest";
import { parseGtxFull } from "../src/lib/providers/free/gtx";
import { levenshteinAtMost, pickSense, stemEquivalent, tokenize } from "../src/lib/sense/match";

// Recorded from the live endpoint for en->uk "bat" (dt=t,bd). The candidate entries carry no score,
// which is why the parser keeps the order the endpoint returned.
const GTX_BAT = [
  [["кажан", "bat", null, null, 10]],
  [
    ["adjective", ["нічвидний"], [["нічвидний", ["bat", "ugly", "repulsive"]]], "bat", 3],
    [
      "noun",
      ["сварлива баба", "битка", "нетопир", "кажан", "кийок", "ракетка"],
      [
        ["сварлива баба", ["bat"]],
        ["битка", ["bat"]],
        ["нетопир", ["bat"]],
        ["кажан", ["bat", "flittermouse", "vampire"]],
        ["кийок", ["baton", "club", "bat"]],
        ["ракетка", ["racket", "bat"]],
      ],
      "bat",
      1,
    ],
  ],
];

describe("stemEquivalent", () => {
  it("accepts the same word in another form", () => {
    expect(stemEquivalent("битка", "битою", "uk")).toBe(true);
    expect(stemEquivalent("битка", "бита", "uk")).toBe(true);
    expect(stemEquivalent("маяк", "маяком", "uk")).toBe(true);
    expect(stemEquivalent("ракетка", "ракеткою", "uk")).toBe(true);
    expect(stemEquivalent("Битка", " битку.", "uk")).toBe(true);
  });

  it("follows the Slavic stem alternation only for inflected targets", () => {
    expect(stemEquivalent("стіл", "столу", "uk")).toBe(true);
    expect(stemEquivalent("стіл", "столу", "de")).toBe(false);
  });

  it("rejects different words", () => {
    expect(stemEquivalent("кажан", "битою", "uk")).toBe(false);
    expect(stemEquivalent("весна", "пружина", "uk")).toBe(false);
    expect(stemEquivalent("", "битка", "uk")).toBe(false);
  });

  it("requires short words to match exactly, so рак is not ракета", () => {
    expect(stemEquivalent("рак", "ракета", "uk")).toBe(false);
    expect(stemEquivalent("рак", "рак", "uk")).toBe(true);
    expect(stemEquivalent("кіт", "кота", "uk")).toBe(false);
  });
});

describe("levenshteinAtMost", () => {
  it("measures small edits and bails out early", () => {
    expect(levenshteinAtMost("битка", "битки", 1)).toBe(true);
    expect(levenshteinAtMost("битка", "кажан", 2)).toBe(false);
    expect(levenshteinAtMost("aaa", "aaaaaaa", 2)).toBe(false);
  });
});

describe("tokenize", () => {
  it("splits on punctuation and keeps apostrophes", () => {
    expect(tokenize("Він змахнув битою, і — хоумран!")).toEqual(["він", "змахнув", "битою", "і", "хоумран"]);
    expect(tokenize("п'ять")).toEqual(["пʼять"]);
  });
});

describe("pickSense", () => {
  const senses = parseGtxFull(GTX_BAT).senses;

  it("keeps every candidate the endpoint returned", () => {
    expect(senses.map((s) => s.term)).toContain("битка");
    expect(senses.map((s) => s.term)).toContain("кажан");
    expect(senses.every((s) => s.score === 0)).toBe(true); // no scores in the live payload
  });

  it("picks the baseball sense from the translated sentence", () => {
    expect(pickSense(senses, "Він змахнув битою і зробив хоумран у дев'ятому інінгу.", "uk")).toEqual({ term: "битка", match: "stem" });
  });

  it("picks the animal sense from a different sentence", () => {
    expect(pickSense(senses, "Кажан вилетів із печери в сутінках.", "uk")).toEqual({ term: "кажан", match: "exact" });
  });

  it("prefers an exact hit over a stem hit regardless of order", () => {
    expect(pickSense(senses, "Кажан сидів поруч із биткою.", "uk")).toEqual({ term: "кажан", match: "exact" });
  });

  it("returns null when the sentence says nothing about the senses", () => {
    expect(pickSense(senses, "Сьогодні тепла й сонячна погода.", "uk")).toBeNull();
    expect(pickSense(senses, "", "uk")).toBeNull();
    expect(pickSense([], "Він змахнув битою.", "uk")).toBeNull();
  });

  it("requires every word of a multi-word candidate", () => {
    expect(pickSense(senses, "Це сварлива баба з сусіднього будинку.", "uk")).toEqual({ term: "сварлива баба", match: "exact" });
    expect(pickSense(senses, "Це сварлива жінка.", "uk")).toBeNull();
  });
});

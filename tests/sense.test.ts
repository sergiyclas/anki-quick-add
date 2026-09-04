import { describe, expect, it } from "vitest";
import { parseGtxFull } from "../src/lib/providers/free/gtx";
import { contextWindow, diffTokens, levenshteinAtMost, pickSense, removeWord, stemEquivalent, tokenize } from "../src/lib/sense/match";

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

  it("lets a short word take an ending but not a whole new word", () => {
    expect(stemEquivalent("бас", "басу", "uk")).toBe(true); // otherwise "басовий" wins over "бас"
    expect(stemEquivalent("кіт", "кота", "uk")).toBe(true); // through the і/о fold
    expect(stemEquivalent("рак", "ракета", "uk")).toBe(false);
    expect(stemEquivalent("рак", "ракети", "uk")).toBe(false);
    expect(stemEquivalent("рак", "рак", "uk")).toBe(true);
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

  it("prefers the candidate closest to the form used in the sentence", () => {
    // The adjective is listed before the noun, and both share the stem: the noun has to win.
    const bass = [{ term: "басовий" }, { term: "бас" }];
    expect(pickSense(bass, "Він багато років грав на басу в джаз-бенді.", "uk")).toEqual({ term: "бас", match: "stem" });
  });

  it("requires every word of a multi-word candidate", () => {
    expect(pickSense(senses, "Це сварлива баба з сусіднього будинку.", "uk")).toEqual({ term: "сварлива баба", match: "exact" });
    expect(pickSense(senses, "Це сварлива жінка.", "uk")).toBeNull();
  });
});

// The dictionary has no verb sense for "facing", so the sense picker cannot help. What does help is
// translating a short window and seeing what disappears when the word is taken out of it.
describe("context window", () => {
  const sentence = "the operational challenges we were facing as our own company grew";

  it("takes two words on each side", () => {
    expect(contextWindow(sentence, "facing")).toBe("we were facing as our");
    expect(removeWord("we were facing as our", "facing")).toBe("we were as our");
  });

  it("clips at the start and the end of the sentence", () => {
    expect(contextWindow("Facing the wall", "facing")).toBe("Facing the wall");
    expect(contextWindow("She sat facing", "facing")).toBe("She sat facing");
  });

  it("gives up when the word is absent or repeated", () => {
    expect(contextWindow(sentence, "sailing")).toBe("");
    expect(contextWindow("a bat chased another bat home", "bat")).toBe("");
  });
});

describe("diffTokens", () => {
  it("returns the word the translation loses", () => {
    expect(diffTokens("ми стикалися як", "ми були як", "uk")).toEqual(["стикалися"]);
  });

  it("ignores endings that only changed form", () => {
    expect(diffTokens("він читав книгу", "він читає книга", "uk")).toEqual([]);
  });

  it("sees through a reworded sentence as long as one word is really new", () => {
    // "старому"/"Старий" and "проіржавіла"/"проіржавів" are the same words in another form.
    expect(diffTokens("Пружина в старому матраці проіржавіла", "Старий матрац наскрізь проіржавів", "uk")).toEqual(["пружина"]);
  });

  it("refuses a difference too noisy to be one word", () => {
    expect(diffTokens("Він вирішив балотуватися наступного року", "Сьогодні надворі тепла сонячна погода", "uk")).toEqual([]);
  });

  it("drops one-letter and two-letter leftovers", () => {
    expect(diffTokens("він у балотуватися", "він балотуватися", "uk")).toEqual([]);
  });
});

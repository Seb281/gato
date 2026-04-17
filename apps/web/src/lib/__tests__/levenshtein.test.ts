import { describe, it, expect } from "vitest";
import { levenshteinDistance, isCloseEnough } from "../levenshtein";

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("hola", "hola")).toBe(0);
  });

  it("returns the length of the other string when one is empty", () => {
    expect(levenshteinDistance("", "hola")).toBe(4);
    expect(levenshteinDistance("hola", "")).toBe(4);
  });

  it("counts single-edit differences as 1", () => {
    expect(levenshteinDistance("kitten", "sitten")).toBe(1); // substitution
    expect(levenshteinDistance("kitten", "kittens")).toBe(1); // insertion
    expect(levenshteinDistance("kitten", "kittn")).toBe(1); // deletion
  });

  it("handles the classic kitten -> sitting transform (distance 3)", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
  });

  it("is case-sensitive (delegates normalization to callers)", () => {
    expect(levenshteinDistance("Hola", "hola")).toBe(1);
  });
});

describe("isCloseEnough", () => {
  it("returns true for exact matches regardless of case and surrounding whitespace", () => {
    expect(isCloseEnough("  Hola  ", "hola")).toBe(true);
  });

  it("accepts typos within the default tolerance of 2", () => {
    expect(isCloseEnough("holaa", "hola")).toBe(true); // 1 edit
    expect(isCloseEnough("hoolaa", "hola")).toBe(true); // 2 edits
  });

  it("rejects typos beyond the default tolerance", () => {
    expect(isCloseEnough("xxxxx", "hola")).toBe(false);
  });

  it("honors a custom maxDistance", () => {
    expect(isCloseEnough("holaaa", "hola", 3)).toBe(true);
    expect(isCloseEnough("holaaa", "hola", 1)).toBe(false);
  });
});

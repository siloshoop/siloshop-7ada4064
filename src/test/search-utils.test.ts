import { describe, expect, it } from "vitest";
import { buildFuzzyPatterns, matchesSearchTerm, normalizeSearchTerm } from "@/lib/search";

describe("search utilities", () => {
  it("normalizes common Arabic letter variants", () => {
    expect(normalizeSearchTerm("أحذية رياضية")).toBe("احذيه رياضيه");
  });

  it("matches exact products even when Arabic typing differs slightly", () => {
    expect(matchesSearchTerm("أحذية رياضية", "احذية")).toBe(true);
  });

  it("matches Latin text case-insensitively", () => {
    expect(matchesSearchTerm("Gaming Laptop", "gaming")).toBe(true);
  });
});
describe("buildFuzzyPatterns", () => {
  it("tolerates Arabic letter variants and the article", () => {
    const [p] = buildFuzzyPatterns("الأحذية");
    expect(p).toBe("%_حذ___%");
  });
  it("splits words so each must match", () => {
    expect(buildFuzzyPatterns("حذاء رياضي")).toHaveLength(2);
  });
});

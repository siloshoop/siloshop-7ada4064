import { describe, expect, it } from "vitest";
import { matchesSearchTerm, normalizeSearchTerm } from "@/lib/search";

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
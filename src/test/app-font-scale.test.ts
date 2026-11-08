import { describe, expect, it } from "vitest";
import { applyAppFontScale, clampAppFontScale } from "@/lib/appFontScale";

describe("app text size follows the phone setting", () => {
  it("enlarged phone text enlarges the app (Android 'Large' = 115%)", () => {
    const root = document.createElement("html");
    expect(applyAppFontScale(1.15, root)).toBe(1.15);
    expect(root.style.fontSize).toBe("115%");
    expect(root.hasAttribute("data-app-font-scaled")).toBe(true);
  });

  it("the largest supported size is 130%", () => {
    expect(clampAppFontScale(1.3)).toBe(1.3);
    expect(clampAppFontScale(2)).toBe(1.3);
  });

  it("default or smaller phone text keeps the designed size", () => {
    const root = document.createElement("html");
    root.style.fontSize = "130%";
    root.setAttribute("data-app-font-scaled", "");
    expect(applyAppFontScale(0.85, root)).toBe(1);
    expect(root.style.fontSize).toBe("");
    expect(root.hasAttribute("data-app-font-scaled")).toBe(false);
  });

  it("an unreadable value keeps the designed size", () => {
    expect(clampAppFontScale(Number.NaN)).toBe(1);
    expect(clampAppFontScale("abc")).toBe(1);
  });
});

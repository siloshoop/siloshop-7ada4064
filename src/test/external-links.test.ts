import { beforeEach, describe, expect, it, vi } from "vitest";

const { isNativePlatform } = vi.hoisted(() => ({ isNativePlatform: vi.fn(() => false) }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform } }));

import { externalLinkTarget, TELEGRAM_URL } from "@/lib/externalLinks";
import { openSocialShare } from "@/lib/share";

describe("social app/browser handoff", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    isNativePlatform.mockReturnValue(false);
  });

  it("uses the exact official Telegram HTTPS URL with browser fallback", () => {
    expect(TELEGRAM_URL).toBe("https://t.me/siloshoop");
    expect(new URL(TELEGRAM_URL).protocol).toBe("https:");
  });

  it("retains browser new-tab navigation", () => {
    expect(externalLinkTarget()).toBe("_blank");
  });

  it("uses native same-window handoff instead of a WebView popup", () => {
    isNativePlatform.mockReturnValue(true);
    expect(externalLinkTarget()).toBe("_self");
    const popup = vi.spyOn(window, "open").mockReturnValue(null);
    const attempts: { href: string; target: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      attempts.push({ href: this.href, target: this.target });
    });
    expect(openSocialShare("telegram", "/product/123")).toBe(true);
    expect(popup).not.toHaveBeenCalled();
    expect(attempts).toEqual([{
      href: "https://t.me/share/url?url=https%3A%2F%2Fwww.siloshop.net%2Fproduct%2F123&text=",
      target: "_self",
    }]);
  });
});
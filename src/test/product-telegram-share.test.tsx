import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { native } = vi.hoisted(() => ({ native: vi.fn(() => false) }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: native } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import ShareProductButton from "@/components/product/ShareProductButton";

describe("product Telegram sharing", () => {
  beforeEach(() => native.mockReturnValue(false));

  for (const isNative of [false, true]) {
    it(`shares the actual product and Arabic name with ${isNative ? "native app/browser" : "browser"} handoff`, () => {
      native.mockReturnValue(isNative);
      render(<ShareProductButton productId="product-123" productName="قميص صيفي" showTelegram />);
      let destination: URL | undefined;
      let target: string | undefined;
      const capture = (event: MouseEvent) => {
        const anchor = (event.target as Element).closest("a");
        if (!anchor) return;
        event.preventDefault();
        destination = new URL(anchor.href);
        target = anchor.target;
      };
      document.addEventListener("click", capture, true);
      fireEvent.click(screen.getByRole("link", { name: "مشاركة المنتج عبر تيليجرام" }));
      document.removeEventListener("click", capture, true);
      expect(destination?.origin).toBe("https://t.me");
      expect(destination?.pathname).toBe("/share/url");
      expect(destination?.searchParams.get("url")).toBe("https://www.siloshop.net/product/product-123");
      expect(destination?.searchParams.get("text")).toBe("قميص صيفي على SiloShop");
      expect(target).toBe(isNative ? "_self" : "_blank");
    });
  }
});
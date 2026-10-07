import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import OrderProductImage, { resolveOrderImage } from "@/components/orders/OrderProductImage";

const mocks = vi.hoisted(() => ({ native: false, from: vi.fn() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => mocks.native } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: mocks.from,
  storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.example/product-images/${path}` } }) }) },
} }));
afterEach(() => { cleanup(); mocks.native = false; vi.clearAllMocks(); });

describe("order product images", () => {
  it("keeps snapshot URLs and resolves bucket paths", () => {
    expect(resolveOrderImage("https://example.com/item.jpg")).toBe("https://example.com/item.jpg");
    expect(resolveOrderImage("product-images/vendor/item.jpg")).toBe("https://storage.example/product-images/vendor/item.jpg");
  });
  it("uses production for site-relative images on Android, not its localhost origin", () => {
    mocks.native = true;
    expect(resolveOrderImage("/assets/item.jpg")).toBe("https://www.siloshop.net/assets/item.jpg");
  });
  it("falls back to the supplied product image when a snapshot fails", () => {
    render(<OrderProductImage image="https://example.com/old.jpg" fallbackImage="https://example.com/new.jpg" alt="منتج" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/new.jpg");
  });
  it("reads an accessible current image for a broken seller snapshot", async () => {
    mocks.from.mockImplementation((table: string) => ({ select: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: table === "order_items" ? { product_id: "product" } : { image_url: "https://example.com/current.jpg", images: [] } }),
    }) }) }));
    render(<OrderProductImage image="https://example.com/broken.jpg" orderItemId="item" alt="منتج" />);
    fireEvent.error(screen.getByRole("img"));
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/current.jpg"));
  });
  it("stops at the placeholder when no image is available", () => {
    render(<OrderProductImage image="https://example.com/broken.jpg" alt="منتج" />);
    fireEvent.error(screen.getByRole("img"));
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/placeholder.svg");
  });
});
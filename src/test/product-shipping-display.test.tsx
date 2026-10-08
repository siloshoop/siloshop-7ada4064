import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import {
  isFreeShipping,
  resolveShippingMode,
  shippingCardLabel,
  shippingChargeAmount,
  shippingDetailLabel,
} from "@/lib/shippingDisplay";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/hooks/useVendorNames", () => ({ useVendorNames: () => ({}) }));
vi.mock("@/lib/productCardMeta", () => ({
  loadProductCardMeta: async () => ({ stock_quantity: 5 }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from, rpc: async () => ({ data: [] }) },
}));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useCompareProducts", () => ({ useCompareProducts: () => ({ addProduct: vi.fn() }) }));
vi.mock("@/components/FavoriteButton", () => ({ FavoriteButton: () => null }));

afterEach(() => {
  cleanup();
  mocks.from.mockReset();
});

const renderCard = (props: { shippingCost?: number; shippingMode?: string | null; currency?: string }) => {
  mocks.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { stock_quantity: 5 } }) }) }),
  }));
  return render(
    <MemoryRouter>
      <ProductCard
        id="product-id"
        name="منتج"
        price={20}
        image="/placeholder.svg"
        rating={0}
        reviews={0}
        {...props}
      />
    </MemoryRouter>,
  );
};

describe("shipping basis resolution", () => {
  it("keeps the seller's explicit choice", () => {
    expect(resolveShippingMode("free", 0)).toBe("free");
    expect(resolveShippingMode("fixed", 5000)).toBe("fixed");
    expect(resolveShippingMode("variable", 0)).toBe("variable");
  });
  it("derives the basis for rows saved before the choice existed", () => {
    expect(resolveShippingMode(null, 0)).toBe("free");
    expect(resolveShippingMode(null, 5000)).toBe("fixed");
    expect(resolveShippingMode(undefined, undefined)).toBe("free");
  });
  it("never treats a shipping price as free shipping", () => {
    expect(isFreeShipping("fixed", 5000)).toBe(false);
    expect(isFreeShipping(null, 5000)).toBe(false);
    expect(isFreeShipping("variable", 0)).toBe(false);
    expect(shippingChargeAmount("variable", 5000)).toBe(0);
    expect(shippingChargeAmount("fixed", 5000)).toBe(5000);
  });
  it("labels each basis in the product's own currency", () => {
    expect(shippingCardLabel("free", 0)).toBe("شحن مجاني");
    expect(shippingCardLabel("fixed", 5, "USD")).toBe("شحن: $5");
    expect(shippingCardLabel("fixed", 5000, "SYP")).toBe("شحن: 5,000 ل.س");
    expect(shippingCardLabel("variable", 0)).toBe("حسب شركة الشحن");
    expect(shippingCardLabel(undefined, undefined)).toBeNull();
    expect(shippingDetailLabel("variable", 0)).toBe("الشحن حسب شركة الشحن");
    expect(shippingDetailLabel("fixed", 5, "USD")).toBe("الشحن: $5");
  });
});

describe("shipping line on product cards", () => {
  it("shows free shipping in green when shipping is free", () => {
    renderCard({ shippingMode: "free", shippingCost: 0 });
    const line = screen.getByText(/شحن مجاني/);
    expect(line).toHaveClass("text-success");
    expect(screen.queryByText(/شحن: /)).not.toBeInTheDocument();
  });

  it("shows the fixed price in the product currency and never says free", () => {
    renderCard({ shippingMode: "fixed", shippingCost: 5, currency: "USD" });
    const line = screen.getByText(/شحن: \$5/);
    expect(line).not.toHaveClass("text-success");
    expect(screen.queryByText(/شحن مجاني/)).not.toBeInTheDocument();
  });

  it("shows that the shipping company sets the price", () => {
    renderCard({ shippingMode: "variable", shippingCost: 0 });
    expect(screen.getByText(/حسب شركة الشحن/)).toBeInTheDocument();
    expect(screen.queryByText(/شحن مجاني/)).not.toBeInTheDocument();
  });

  it("shows a saved price as a price even when the basis was never chosen", () => {
    renderCard({ shippingCost: 5000, currency: "SYP" });
    expect(screen.getByText(/شحن: 5,000 ل\.س/)).toBeInTheDocument();
    expect(screen.queryByText(/شحن مجاني/)).not.toBeInTheDocument();
  });

  it("shows nothing when the listing carries no shipping data", () => {
    renderCard({});
    expect(screen.queryByText(/شحن/)).not.toBeInTheDocument();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProductCard from "@/components/ProductCard";

const mocks = vi.hoisted(() => ({ stock: 0, from: vi.fn(), metadata: {} as Record<string, unknown> }));
vi.mock("@/hooks/useVendorNames", () => ({ useVendorNames: () => ({ seller: "متجر البائع" }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from, rpc: async () => ({ data: [] }) },
}));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useCompareProducts", () => ({ useCompareProducts: () => ({ addProduct: vi.fn() }) }));
vi.mock("@/components/FavoriteButton", () => ({ FavoriteButton: () => null }));
afterEach(() => { cleanup(); mocks.metadata = {}; });

const renderCard = (stockQuantity?: number) => {
  mocks.from.mockImplementation(() => ({ select: () => ({ eq: () => ({
    maybeSingle: async () => ({ data: { stock_quantity: mocks.stock, ...mocks.metadata } }),
  }) }) }));
  return render(<MemoryRouter><Routes>
    <Route path="/" element={<ProductCard id="product-id" name="منتج" price={20} image="/placeholder.svg" rating={0} reviews={0} stockQuantity={stockQuantity} />} />
    <Route path="/product/:id" element={<div>صفحة المنتج</div>} />
  </Routes></MemoryRouter>);
};

describe("product listings", () => {
  it.each([0, 5])("has no cart button and opens details when stock is %s", async (stock) => {
    mocks.stock = stock;
    renderCard(stock);
    expect(screen.queryByRole("button", { name: /السلة|للسلة/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link"));
    expect(screen.getByText("صفحة المنتج")).toBeInTheDocument();
    expect(mocks.from.mock.calls.every(([table]) => table === "products")).toBe(true);
  });
  it("shows saved sold-out stock even if a listing supplies stale positive stock", async () => {
    mocks.stock = 0;
    renderCard(8);
    await waitFor(() => expect(screen.getByText("نفذت الكمية")).toBeInTheDocument());
  });
  it("loads omitted stock and updates sold-out/restocked badges on stock and focus events", async () => {
    mocks.stock = 0;
    renderCard();
    await waitFor(() => expect(screen.getByText("نفذت الكمية")).toBeInTheDocument());
    mocks.stock = 6;
    fireEvent(window, new Event("stock-updated"));
    await waitFor(() => expect(screen.queryByText("نفذت الكمية")).not.toBeInTheDocument());
    mocks.stock = 0;
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(screen.getByText("نفذت الكمية")).toBeInTheDocument());
  });
  it("shows saved seller, reviews and truthful merchandising badges on every shared card", async () => {
    mocks.stock = 8;
    mocks.metadata = { vendor_id: "seller", is_trending: true, reviews: [{ rating: 4 }, { rating: 5 }] };
    renderCard(8);
    await waitFor(() => expect(screen.getByText("متجر البائع")).toBeInTheDocument());
    expect(screen.getByText("رائج الآن")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "التقييم 4.5 من 5" })).toBeInTheDocument();
    expect(screen.getByText("4.5 (2)")).toBeInTheDocument();
    expect(screen.queryByText(/إعلان ممول|الأكثر زيارة|الأكثر مبيع/)).not.toBeInTheDocument();
    expect(screen.getByAltText("منتج")).toHaveClass("object-contain");
  });
  it("shows a featured badge only for a saved featured flag", async () => {
    mocks.stock = 8;
    mocks.metadata = { is_featured: true, reviews: [] };
    renderCard(8);
    await waitFor(() => expect(screen.getByText("منتج مميز")).toBeInTheDocument());
    expect(screen.getByText("— (0)")).toBeInTheDocument();
  });
  it("displays a real discount and both prices without currency conversion", () => {
    render(<MemoryRouter><ProductCard name="خصم حقيقي" image="/placeholder.svg" price={75} originalPrice={100} currency="USD" rating={0} reviews={0} /></MemoryRouter>);
    expect(screen.getByText("خصم 25%")).toBeInTheDocument();
    expect(screen.getByText(/75/)).toHaveTextContent("$");
    expect(screen.getByText(/100/)).toHaveClass("line-through");
  });
});
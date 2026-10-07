import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProductCard from "@/components/ProductCard";

const mocks = vi.hoisted(() => ({ stock: 0, from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from, rpc: async () => ({ data: [] }) },
}));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useCompareProducts", () => ({ useCompareProducts: () => ({ addProduct: vi.fn() }) }));
vi.mock("@/components/FavoriteButton", () => ({ FavoriteButton: () => null }));
afterEach(cleanup);

const renderCard = (stockQuantity?: number) => {
  mocks.from.mockImplementation(() => ({ select: () => ({ eq: () => ({
    maybeSingle: async () => ({ data: { stock_quantity: mocks.stock } }),
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
});
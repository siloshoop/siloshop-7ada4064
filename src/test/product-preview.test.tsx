import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpc = vi.fn();
const trackProductView = vi.fn();
const addCompareProduct = vi.fn();
const toast = vi.fn();
const cartWrites = vi.fn();

const product = {
  id: "p1", name: "بدلة كارديجان مخططة", description: "وصف", price: 35, original_price: null,
  currency: "USD", stock_quantity: 10, shipping_cost: null, shipping_mode: "free", image_url: "x.jpg",
  images: ["x.jpg"], vendor_id: "v1", category_id: null, product_type: "platform",
  is_active: false, moderation_status: "approved", reviews: [],
};

const chain = (table: string) => {
  const q: any = {
    select: () => q, eq: () => q, is: () => q,
    maybeSingle: async () => ({ data: table === "products" ? product : null, error: null }),
    then: (resolve: any) => resolve({ data: [], error: null }),
    insert: (...a: unknown[]) => { cartWrites(table, a); return Promise.resolve({ error: null }); },
    update: (...a: unknown[]) => { cartWrites(table, a); return q; },
  };
  return q;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => chain(t),
    rpc: (...a: unknown[]) => { rpc(...a); return Promise.resolve({ data: [{ full_name: "SiloShop" }], error: null }); },
    channel: () => { const c: any = { on: () => c, subscribe: () => c }; return c; },
    removeChannel: vi.fn(),
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "owner" } }) }));
vi.mock("@/hooks/useRecentlyViewed", () => ({ useRecentlyViewed: () => ({ trackProductView }) }));
vi.mock("@/hooks/useCompareProducts", () => ({ useCompareProducts: () => ({ addProduct: addCompareProduct }) }));
vi.mock("@/hooks/useShippingRegions", () => ({ useShippingRegions: () => ({ data: [] }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/dealPricing", () => ({ fetchActiveDeals: async () => ({}), applyDeal: (p: number) => p }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/NativeAdBanner", () => ({ default: () => null }));
vi.mock("@/components/SimilarProducts", () => ({ default: () => null }));
vi.mock("@/components/ProductRecommendations", () => ({ default: () => null }));
vi.mock("@/components/product/FrequentlyBoughtTogether", () => ({ default: () => null }));
vi.mock("@/components/ChatButton", () => ({ default: () => null }));
vi.mock("@/components/product/ShareProductButton", () => ({ default: () => null }));
vi.mock("@/components/ReportDialog", () => ({ default: () => null }));
vi.mock("@/components/product/SellerInfoCard", () => ({ default: () => null }));
vi.mock("@/components/MarketPriceBar", () => ({ default: () => null }));
vi.mock("@/components/product/ShippingInfo", () => ({ default: () => null }));
vi.mock("@/components/product/ProductSpecs", () => ({ default: () => null }));
vi.mock("@/components/product/ProductOriginBadge", () => ({ default: () => null }));
vi.mock("@/components/product/ProductVariantPicker", () => ({ default: () => null }));
vi.mock("@/components/product/ProductQuestions", () => ({ default: () => null }));
vi.mock("@/components/SeoHead", () => ({ default: () => null }));
vi.mock("@/components/ImageGallery", () => ({ ImageGallery: () => null }));
vi.mock("@/components/ProductReviews", () => ({ ProductReviews: () => null }));
vi.mock("@/components/VendorRating", () => ({ VendorRating: () => null }));
vi.mock("@/components/FavoriteButton", () => ({ FavoriteButton: () => null }));

import Product from "@/pages/Product";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/product/:id" element={<Product />} />
        <Route path="/product/:id/preview" element={<Product preview />} />
      </Routes>
    </MemoryRouter>,
  );

const viewCalls = () => rpc.mock.calls.filter(([name]) => name === "track_product_metric");

describe("product preview", () => {
  beforeEach(() => { rpc.mockClear(); trackProductView.mockClear(); addCompareProduct.mockClear(); cartWrites.mockClear(); });

  it("the customer page still counts one view and records recently viewed", async () => {
    renderAt("/product/p1");
    await screen.findByRole("heading", { name: product.name });
    await waitFor(() => expect(viewCalls()).toHaveLength(1));
    expect(trackProductView).toHaveBeenCalledWith("p1");
  });

  it("the preview never increases the view count or recently viewed", async () => {
    renderAt("/product/p1/preview");
    await screen.findByRole("heading", { name: product.name });
    await new Promise((r) => setTimeout(r, 20));
    expect(viewCalls()).toHaveLength(0);
    expect(trackProductView).not.toHaveBeenCalled();
  });

  it("the preview shows an unpublished inactive product with an «غير منشور» status", async () => {
    renderAt("/product/p1/preview");
    const banner = await screen.findByTestId("product-preview-banner");
    expect(banner.textContent).toContain("غير منشور");
  });

  it("the preview cannot add to the cart or compare list", async () => {
    renderAt("/product/p1/preview");
    await screen.findByRole("heading", { name: product.name });
    for (const b of screen.getAllByRole("button", { name: /أضف إلى السلة|اشترِ الآن|مقارنة/ })) fireEvent.click(b);
    await new Promise((r) => setTimeout(r, 20));
    expect(cartWrites).not.toHaveBeenCalled();
    expect(addCompareProduct).not.toHaveBeenCalled();
  });
});

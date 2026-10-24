import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  saved: {} as Record<string, any>, update: vi.fn(), eq: vi.fn(), toast: vi.fn(),
  user: { id: "seller-shipping-test" },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/ImageCropDialog", () => ({ useImageCropper: () => ({ crop: vi.fn(), dialog: null }) }));
vi.mock("@/components/seller/ProductVariantsManager", () => ({ default: () => null }));
vi.mock("@/components/seller/ProductColorsSizesEditor", () => ({ default: () => null, buildVariantRows: () => [] }));
vi.mock("@/lib/productVariantsSync", () => ({ syncColorSizeVariants: async () => {}, COLOR_ATTR: "color", SIZE_ATTR: "size" }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const chain: any = {
      select: () => chain,
      eq: (...args: any[]) => { mocks.eq(...args); return chain; },
      order: async () => ({ data: [] }),
      single: async () => ({ data: { ...mocks.saved, images: [...mocks.saved.images] }, error: null }),
      maybeSingle: async () => ({ data: { moderation_status: "approved" }, error: null }),
      update: (values: any) => { mocks.update(values); Object.assign(mocks.saved, values); return chain; },
      then: (resolve: any) => resolve({ data: table === "products" ? mocks.saved : [], error: null }),
    };
    return chain;
  },
} }));
import EditProduct from "@/pages/EditProduct";
import ProductSpecs from "@/components/product/ProductSpecs";
import { resolveShippingMode, isFreeShipping } from "@/lib/shippingDisplay";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  mocks.saved = { id: "shipping-fixture", vendor_id: mocks.user.id, name: "منتج اختبار الشحن", price: 20, currency: "USD", stock_quantity: 5, shipping_mode: "free", shipping_cost: 0, images: ["/placeholder.svg"], is_active: true };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const edit = () => render(<MemoryRouter initialEntries={["/edit/shipping-fixture"]}><Routes><Route path="/edit/:id" element={<EditProduct />} /></Routes></MemoryRouter>);

describe("seller shipping choice persistence", () => {
  it("saves the company-selected mode, reloads it, and exposes the same saved mode to buyers", async () => {
    edit();
    await screen.findByDisplayValue("منتج اختبار الشحن");
    fireEvent.click(screen.getByRole("button", { name: "الشحن", exact: true }));
    fireEvent.click(screen.getByRole("radio", { name: /حسب شركة الشحن/ }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ التغييرات" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ shipping_mode: "variable", shipping_cost: 0 })));
    expect(mocks.eq).toHaveBeenCalledWith("vendor_id", "seller-shipping-test");
    cleanup();
    edit();
    await screen.findByDisplayValue("منتج اختبار الشحن");
    fireEvent.click(screen.getByRole("button", { name: "الشحن", exact: true }));
    expect(screen.getByRole("radio", { name: /حسب شركة الشحن/ })).toBeChecked();
    expect(resolveShippingMode(mocks.saved.shipping_mode, mocks.saved.shipping_cost)).toBe("variable");
    expect(isFreeShipping(mocks.saved.shipping_mode, mocks.saved.shipping_cost)).toBe(false);
    cleanup();
    render(<ProductSpecs product={mocks.saved} />);
    expect(screen.getByText("الشحن حسب شركة الشحن")).toBeInTheDocument();
  });

  it("preserves a legacy missing choice when saving unrelated edits, without creating explicit free shipping", async () => {
    mocks.saved.shipping_mode = null;
    edit();
    await screen.findByDisplayValue("منتج اختبار الشحن");
    fireEvent.click(screen.getByRole("button", { name: "حفظ التغييرات" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ shipping_mode: null, shipping_cost: 0 })));
    expect(isFreeShipping(mocks.saved.shipping_mode, mocks.saved.shipping_cost)).toBe(false);
  });
});
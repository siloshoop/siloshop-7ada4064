import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Isolated: every backend call is mocked — no real coupons, orders or tracking rows.
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

import { quoteCoupon } from "@/lib/couponQuote";
import { totalsByCurrency, sumByCurrency, formatAmountsByCurrency, formatSplitTotals, formatPrice } from "@/lib/currency";
import { buildInvoiceBlocks } from "@/lib/invoiceTotals";
import GuestTrack from "@/pages/GuestTrack";

beforeEach(() => rpc.mockReset());

describe("coupons (mocked quote)", () => {
  it("USD coupon discount stays in USD and leaves SYP lines untouched", async () => {
    rpc.mockResolvedValue({ data: [{ id: "c1", code: "USD10", vendor_id: "v", discount_type: "percentage", discount_value: 10, currency: "USD", eligible_subtotal: 126.5, discount_amount: 12.65, error: null }], error: null });
    const q = await quoteCoupon(" usd10 ", [{ product_id: "p", quantity: 2 }]);
    expect(rpc).toHaveBeenCalledWith("quote_cart_coupon", expect.objectContaining({ _code: "USD10" }));
    const t = totalsByCurrency([{ currency: "USD", lineSubtotal: 126.5, shipping: 3.5 }, { currency: "SYP", lineSubtotal: 100000, shipping: 2000 }], { couponCurrency: q!.currency as "USD", couponDiscount: q!.discount_amount });
    expect(t.find((x) => x.currency === "USD")!.total).toBeCloseTo(117.35, 2);
    expect(t.find((x) => x.currency === "SYP")!.total).toBe(102000);
  });
  it("SYP coupon discount stays in SYP and never exceeds the SYP subtotal", async () => {
    rpc.mockResolvedValue({ data: { id: "c2", code: "SYP", vendor_id: "v", discount_type: "fixed", discount_value: 500000, currency: "SYP", eligible_subtotal: 100000, discount_amount: 500000, error: null }, error: null });
    const q = await quoteCoupon("syp", [{ product_id: "p", quantity: 1 }]);
    const t = totalsByCurrency([{ currency: "SYP", lineSubtotal: 100000, shipping: 2000 }, { currency: "USD", lineSubtotal: 20 }], { couponCurrency: "SYP", couponDiscount: q!.discount_amount });
    expect(t.find((x) => x.currency === "SYP")).toMatchObject({ couponDiscount: 100000, total: 2000 });
    expect(t.find((x) => x.currency === "USD")!.total).toBe(20);
  });
});

describe("SYP invoice", () => {
  it("uses saved SYP totals and formats them as SYP", () => {
    const [b] = buildInvoiceBlocks({ currency: "SYP", subtotal_amount: 395000, discount_amount: 10000, shipping_amount: 2000, total_amount: 387000 }, [{ currency: "SYP", quantity: 1, price: 395000 }]);
    expect(b.currency).toBe("SYP");
    expect(formatPrice(b.total, b.currency)).toBe("387,000 ل.س");
  });
});

describe("admin & seller reports", () => {
  const rows = [{ amount: 53, currency: "USD" }, { amount: 58.5, currency: "USD" }, { amount: 395000, currency: "SYP" }, { amount: 70, currency: null }];
  it("keeps currencies separate and never folds a missing currency into SYP", () => {
    const split = sumByCurrency(rows);
    expect(split.USD?.total).toBe(111.5);
    expect(split.SYP?.total).toBe(395000);
    expect(split.SYP?.count).toBe(1);
    expect(formatSplitTotals(split)).toBe("395,000 ل.س · $111.50");
    expect(formatAmountsByCurrency(rows)).toBe("395,000 ل.س · $111.50 · 70 (العملة غير متاحة)");
  });
});

describe("guest order tracking (mocked lookup)", () => {
  const lookup = async (currency: string | null, total: number) => {
    rpc.mockResolvedValue({ data: { id: "o1", status: "pending", created_at: "2026-10-01T00:00:00Z", total_amount: total, subtotal_amount: total, shipping_amount: 0, currency }, error: null });
    render(<MemoryRouter><GuestTrack /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText("مثال: 8f1c2b34-..."), { target: { value: "o1" } });
    fireEvent.change(screen.getByPlaceholderText("09XXXXXXXX"), { target: { value: "0912345678" } });
    fireEvent.submit(screen.getByPlaceholderText("09XXXXXXXX").closest("form")!);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("track_order_public", { _order_id: "o1", _phone: "0912345678" }));
  };
  it("shows a USD order in dollars", async () => {
    await lookup("USD", 53);
    expect((await screen.findAllByText("$53.00")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/SYP/)).toBeNull();
  });
  it("shows a SYP order in SYP", async () => {
    await lookup("SYP", 102000);
    expect((await screen.findAllByText("102,000 ل.س")).length).toBeGreaterThan(0);
  });
  it("does not label a missing currency as SYP", async () => {
    await lookup(null, 70);
    expect((await screen.findAllByText("70 (العملة غير متاحة)")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/SYP/)).toBeNull();
  });
});

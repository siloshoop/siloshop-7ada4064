import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ProductVariantPicker from "@/components/product/ProductVariantPicker";
import { availableProductStock, optionInStock } from "@/lib/stockAvailability";
import type { Database } from "@/integrations/supabase/types";

type Variant = Database["public"]["Tables"]["product_variants"]["Row"];
const variant = (id: string, attrs: Record<string, string>, stock: number, active = true): Variant => ({
  id, attributes: attrs, stock_quantity: stock, is_active: active, product_id: "product", sku: null,
  price: null, discount_price: null, image_url: null, weight: null, barcode: null,
  created_at: "", updated_at: "", sort_order: 0,
});
afterEach(cleanup);

describe("stock availability", () => {
  it("uses only active available variant quantities, with simple product fallback", () => {
    expect(availableProductStock(99, [variant("a", {}, 2), variant("b", {}, 8, false)])).toBe(2);
    expect(availableProductStock(0, [])).toBe(0);
    expect(availableProductStock(4, [])).toBe(4);
  });
  it.each(["اللون", "المقاس"])("locks zero-stock %s and allows available options", (key) => {
    const onSelect = vi.fn();
    render(<ProductVariantPicker variants={[variant("a", { [key]: "متاح" }, 2), variant("b", { [key]: "نافد" }, 0)]} onSelect={onSelect} />);
    const soldOut = screen.getByRole("button", { name: "نافد — غير متوفر" });
    expect(soldOut).toBeDisabled();
    expect(soldOut).toHaveClass("border-dashed");
    expect(soldOut.querySelector("svg")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "متاح" }));
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: "a" }));
  });
  it("requires a stocked combination of color and size", () => {
    const variants = [variant("a", { اللون: "أسود", المقاس: "M" }, 3), variant("b", { اللون: "أسود", المقاس: "L" }, 0)];
    expect(optionInStock(variants, { اللون: "أسود" }, "المقاس", "L")).toBe(false);
    const onSelect = vi.fn();
    render(<ProductVariantPicker variants={variants} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "أسود" }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    expect(onSelect).toHaveBeenLastCalledWith(variants[0]);
  });
  it("invalidates a selected combination when its saved stock reaches zero", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<ProductVariantPicker variants={[variant("a", { المقاس: "M" }, 1)]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    rerender(<ProductVariantPicker variants={[variant("a", { المقاس: "M" }, 0)]} onSelect={onSelect} />);
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("button", { name: "M — غير متوفر" })).toBeDisabled();
  });
});
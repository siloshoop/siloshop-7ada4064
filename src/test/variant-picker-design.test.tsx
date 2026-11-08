import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Database } from "@/integrations/supabase/types";
import { colorSwatch } from "@/lib/colorSwatch";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import ProductVariantPicker from "@/components/product/ProductVariantPicker";

type Variant = Database["public"]["Tables"]["product_variants"]["Row"];
const variant = (id: string, attrs: Record<string, string>, stock = 3): Variant => ({
  id, attributes: attrs, stock_quantity: stock, is_active: true, product_id: "p1", sku: null,
  price: null, discount_price: null, image_url: "https://example.com/x.jpg", weight: null, barcode: null,
  created_at: "", updated_at: "", sort_order: 0,
});

beforeEach(() => rpc.mockReset());
afterEach(cleanup);

describe("color swatches", () => {
  it("maps saved Arabic and English color names to a solid swatch", () => {
    expect(colorSwatch("أخضر")).toBe(colorSwatch("اخضر"));
    expect(colorSwatch("الابيض")).toBe("#ffffff");
    expect(colorSwatch("Black")).toBe("#111111");
    expect(colorSwatch("دهبي")).toBe(colorSwatch("ذهبي"));
    expect(colorSwatch("أزرق فاتح")).toBe(colorSwatch("أزرق"));
    expect(colorSwatch("نمر مرقط")).toBeNull();
  });

  it("shows a color square instead of the name or picture inside the tile", () => {
    rpc.mockResolvedValue({ data: null, error: null });
    render(<ProductVariantPicker variants={[variant("a", { اللون: "أخضر" }), variant("b", { اللون: "أسود" })]} onSelect={vi.fn()} />);
    const tile = screen.getByRole("button", { name: "أخضر" });
    expect(tile.querySelector("[data-swatch]")).not.toBeNull();
    expect(tile.querySelector("img")).toBeNull();
    expect(tile.textContent).toBe("");
  });
});

describe("popular color tag", () => {
  it("tags only the best-selling color returned by the server", async () => {
    rpc.mockResolvedValue({ data: "أسود", error: null });
    render(<ProductVariantPicker variants={[variant("a", { اللون: "أخضر" }), variant("b", { اللون: "أسود" })]} onSelect={vi.fn()} />);
    expect(rpc).toHaveBeenCalledWith("get_popular_variant_option", { p_product_id: "p1", p_attribute: "اللون" });
    await waitFor(() => expect(screen.getAllByText("شائع")).toHaveLength(1));
    expect(screen.getByRole("button", { name: "أسود" })).toContainElement(screen.getByText("شائع"));
  });

  it("does not ask or tag when the product has only one color", () => {
    render(<ProductVariantPicker variants={[variant("a", { اللون: "أسود" })]} onSelect={vi.fn()} />);
    expect(rpc).not.toHaveBeenCalled();
    expect(screen.queryByText("شائع")).toBeNull();
  });
});

describe("size buttons", () => {
  it("use a white card background and the orange frame only when selected", () => {
    render(<ProductVariantPicker variants={[variant("a", { المقاس: "M" }), variant("b", { المقاس: "L" })]} onSelect={vi.fn()} />);
    const m = screen.getByRole("button", { name: "M" });
    expect(m).toHaveClass("bg-card", "border-border");
    expect(m.className).not.toMatch(/gradient/);
    fireEvent.click(m);
    expect(m).toHaveClass("border-selected", "bg-card");
    expect(screen.getByRole("button", { name: "L" })).not.toHaveClass("border-selected");
  });
});

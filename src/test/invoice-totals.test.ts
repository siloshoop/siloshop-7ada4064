import { describe, expect, it } from "vitest";
import { buildInvoiceBlocks } from "@/lib/invoiceTotals";

describe("buildInvoiceBlocks", () => {
  it("uses the stored order totals for a single-currency order", () => {
    const blocks = buildInvoiceBlocks(
      {
        currency: "SYP",
        subtotal_amount: 100000,
        discount_amount: 5000,
        shipping_amount: 2000,
        tax_amount: 0,
        total_amount: 97000,
      },
      [{ currency: "SYP", quantity: 2, price: 50000, subtotal: 100000 }],
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      currency: "SYP",
      subtotal: 100000,
      discount: 5000,
      shipping: 2000,
      total: 97000,
    });
  });

  it("keeps a USD order in USD without conversion", () => {
    const blocks = buildInvoiceBlocks(
      { currency: "USD", subtotal_amount: 50, shipping_amount: 5, total_amount: 55 },
      [{ currency: "USD", quantity: 1, price: 50, subtotal: 50 }],
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].currency).toBe("USD");
    expect(blocks[0].total).toBe(55);
  });

  it("splits a mixed-currency order into independent blocks, SYP first", () => {
    const blocks = buildInvoiceBlocks(
      {
        currency: "SYP",
        subtotal_amount: 100000,
        discount_amount: 0,
        shipping_amount: 3000,
        total_amount: 103000,
      },
      [
        { currency: "USD", quantity: 2, price: 25, subtotal: 50 },
        { currency: "SYP", quantity: 1, price: 100000, subtotal: 100000 },
      ],
    );
    expect(blocks.map((b) => b.currency)).toEqual(["SYP", "USD"]);
    const [syp, usd] = blocks;
    expect(syp).toMatchObject({ subtotal: 100000, shipping: 3000, total: 103000 });
    // The USD block never receives the order-level shipping recorded in SYP.
    expect(usd).toMatchObject({ subtotal: 50, shipping: 0, discount: 0, total: 50 });
    // Each block is built only from its own currency's items — no cross-currency sum.
    expect(syp.subtotal).toBe(100000);
    expect(usd.subtotal).toBe(50);
  });

  it("falls back to item math when order amounts are missing", () => {
    const blocks = buildInvoiceBlocks({ currency: "SYP" }, [
      { currency: "SYP", quantity: 3, price: 1000, discount_amount: 500 },
    ]);
    expect(blocks[0]).toMatchObject({ subtotal: 3000, discount: 500, total: 2500 });
  });

  it("returns one empty block when the order has no items", () => {
    const blocks = buildInvoiceBlocks({ currency: "USD", total_amount: 0 }, []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].currency).toBe("USD");
  });
});

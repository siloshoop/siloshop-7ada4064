import { describe, expect, it } from "vitest";
import { paymentMethodsLabel, productPaymentMethods } from "../productPaymentMethods";

const opts = { cod_enabled: true, sham_cash_enabled: false, electronic_payment_enabled: false, apply_to_all_products: false };

describe("product payment methods", () => {
  it("platform product with only Sham Cash shows Sham Cash, not cash on delivery", () => {
    const m = productPaymentMethods(
      { product_type: "platform", platform_cod_enabled: false, platform_sham_cash_enabled: true, platform_electronic_payment_enabled: false },
      opts,
    );
    expect(m).toEqual(["sham_cash"]);
    expect(paymentMethodsLabel(m)).toBe("الدفع عبر شام كاش");
  });

  it("platform product with empty choices falls back to the platform settings", () => {
    const m = productPaymentMethods({ product_type: "platform" }, { ...opts, cod_enabled: false, sham_cash_enabled: true });
    expect(m).toEqual(["sham_cash"]);
  });

  it("seller product uses platform settings when they apply to all products", () => {
    const m = productPaymentMethods({ product_type: "seller" }, { ...opts, cod_enabled: false, sham_cash_enabled: true, apply_to_all_products: true });
    expect(m).toEqual(["sham_cash"]);
  });

  it("seller product is cash on delivery when platform settings do not apply to all", () => {
    expect(productPaymentMethods({ product_type: "seller" }, opts)).toEqual(["cod"]);
  });

  it("several methods are listed together", () => {
    const m = productPaymentMethods(
      { product_type: "platform", platform_cod_enabled: true, platform_sham_cash_enabled: true, platform_electronic_payment_enabled: false },
      opts,
    );
    expect(paymentMethodsLabel(m)).toBe("الدفع عند الاستلام أو شام كاش");
  });
});

import { orderPaymentMethodLabel, unionPaymentMethods } from "../productPaymentMethods";

describe("saved order payment method", () => {
  it("a Sham Cash order is shown as Sham Cash", () => {
    expect(orderPaymentMethodLabel("sham_cash")).toBe("شام كاش");
  });
  it("an electronic order is not shown as cash on delivery", () => {
    expect(orderPaymentMethodLabel("electronic")).toBe("الدفع الإلكتروني");
  });
  it("a cash on delivery order stays cash on delivery", () => {
    expect(orderPaymentMethodLabel("cod")).toBe("الدفع عند الاستلام");
  });
});

describe("store payment summary", () => {
  it("platform store with Sham Cash-only products lists only Sham Cash", () => {
    const p = { product_type: "platform", platform_cod_enabled: false, platform_sham_cash_enabled: true, platform_electronic_payment_enabled: false };
    expect(unionPaymentMethods([p, p], { cod_enabled: true, sham_cash_enabled: false, electronic_payment_enabled: false, apply_to_all_products: false })).toEqual(["sham_cash"]);
  });
});

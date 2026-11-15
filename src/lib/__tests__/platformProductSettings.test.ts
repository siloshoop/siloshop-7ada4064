import { describe, expect, it } from "vitest";
import { emptyPlatformSettings, platformProductColumns, platformSettingsFromProduct, validatePlatformSettings } from "@/lib/platformProductSettings";

describe("platform product settings", () => {
  it("requires at least one payment method", () => {
    const v = { ...emptyPlatformSettings(), cod: false, sham_cash: false, electronic: false };
    expect(validatePlatformSettings(v)).toBe("يجب تفعيل طريقة دفع واحدة على الأقل لهذا المنتج");
  });

  it("requires a fee when shipping is paid", () => {
    expect(validatePlatformSettings({ ...emptyPlatformSettings(), free_shipping: false, shipping_fee: "" })).toBe("يرجى إدخال قيمة الشحن للمنتج");
    expect(validatePlatformSettings({ ...emptyPlatformSettings(), free_shipping: false, shipping_fee: "٥٠٠٠" })).toBeNull();
  });

  it("saves paid shipping with its fee and the chosen payment methods", () => {
    const cols = platformProductColumns({ ...emptyPlatformSettings(), free_shipping: false, shipping_fee: "5000", cod: false, sham_cash: true });
    expect(cols).toMatchObject({
      product_type: "platform",
      platform_free_shipping: false,
      platform_shipping_fee: 5000,
      platform_cod_enabled: false,
      platform_sham_cash_enabled: true,
      platform_electronic_payment_enabled: false,
      shipping_mode: "fixed",
      shipping_cost: 5000,
    });
  });

  it("free shipping never keeps a fee", () => {
    const cols = platformProductColumns({ ...emptyPlatformSettings(), free_shipping: true, shipping_fee: "7000" });
    expect(cols.platform_shipping_fee).toBe(0);
    expect(cols.shipping_mode).toBe("free");
  });

  it("reads saved settings back for editing", () => {
    const v = platformSettingsFromProduct({ platform_free_shipping: false, platform_shipping_fee: 2500, platform_cod_enabled: true, platform_sham_cash_enabled: false, platform_electronic_payment_enabled: true, sku: "A1" });
    expect(v).toMatchObject({ free_shipping: false, shipping_fee: "2500", cod: true, sham_cash: false, electronic: true, sku: "A1" });
  });
});

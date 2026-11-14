/**
 * Platform-only settings of a platform product (owner-managed): brand, SKU,
 * delivery estimate, free/paid shipping and allowed payment methods.
 * Everything else about a platform product uses the shared seller product form.
 */
export interface PlatformSettings {
  brand_id: string | null;
  sku: string;
  shipping_duration_text: string;
  free_shipping: boolean;
  shipping_fee: string;
  cod: boolean;
  sham_cash: boolean;
  electronic: boolean;
}

export const emptyPlatformSettings = (): PlatformSettings => ({
  brand_id: null,
  sku: "",
  shipping_duration_text: "",
  free_shipping: true,
  shipping_fee: "",
  cod: true,
  sham_cash: false,
  electronic: false,
});

const latin = (s: string) =>
  s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

export const parseShippingFee = (raw: string): number => {
  const n = Number(latin(raw).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const platformSettingsFromProduct = (p: any): PlatformSettings => ({
  brand_id: p?.brand_id ?? null,
  sku: p?.sku ?? "",
  shipping_duration_text: p?.shipping_duration_text ?? "",
  free_shipping: p?.platform_free_shipping ?? true,
  shipping_fee: p?.platform_shipping_fee != null && Number(p.platform_shipping_fee) > 0 ? String(p.platform_shipping_fee) : "",
  cod: p?.platform_cod_enabled ?? true,
  sham_cash: p?.platform_sham_cash_enabled ?? false,
  electronic: p?.platform_electronic_payment_enabled ?? false,
});

/** Arabic error for invalid settings, or null when they can be saved. */
export const validatePlatformSettings = (v: PlatformSettings): string | null => {
  if (!v.cod && !v.sham_cash && !v.electronic) return "يجب تفعيل طريقة دفع واحدة على الأقل لهذا المنتج";
  if (!v.free_shipping && parseShippingFee(v.shipping_fee) <= 0) return "يرجى إدخال قيمة الشحن للمنتج";
  if (v.shipping_duration_text.trim().length > 80) return "مدة الشحن يجب ألا تتجاوز 80 حرفًا";
  if (v.sku.trim().length > 100) return "رمز المنتج (SKU) طويل جدًا";
  return null;
};

/** Columns saved for a platform product. Shipping display columns mirror the platform shipping choice. */
export const platformProductColumns = (v: PlatformSettings) => {
  const fee = v.free_shipping ? 0 : parseShippingFee(v.shipping_fee);
  return {
    product_type: "platform" as const,
    brand_id: v.brand_id,
    sku: v.sku.trim() || null,
    shipping_duration_text: v.shipping_duration_text.trim() || null,
    platform_free_shipping: v.free_shipping,
    platform_shipping_fee: fee,
    platform_cod_enabled: v.cod,
    platform_sham_cash_enabled: v.sham_cash,
    platform_electronic_payment_enabled: v.electronic,
    shipping_mode: v.free_shipping ? ("free" as const) : ("fixed" as const),
    shipping_cost: fee,
  };
};

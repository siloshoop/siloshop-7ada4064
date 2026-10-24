/**
 * Shipping display helpers.
 *
 * Every product states how shipping is charged:
 *  - "free"     -> the buyer pays nothing for shipping
 *  - "fixed"    -> the seller set a fixed price (shipping_cost, in the product currency)
 *  - "variable" -> the shipping company sets the price
 *
 * Legacy NULL choices retain a positive saved price as fixed. Zero or missing
 * prices do not prove free shipping; only an explicit seller choice does.
 */

import { formatPrice } from "@/lib/currency";

export type ShippingMode = "free" | "fixed" | "variable";

/** The three choices a seller makes for a product, in display order. */
export const SHIPPING_MODE_OPTIONS: { value: ShippingMode; label: string; hint: string }[] = [
  { value: "free", label: "شحن مجاني", hint: "لا يضاف أي مبلغ على المشتري" },
  { value: "fixed", label: "سعر ثابت", hint: "مبلغ ثابت تحدده بنفس عملة سعر المنتج" },
  { value: "variable", label: "حسب شركة الشحن", hint: "تحدده شركة الشحن حسب الوجهة والوزن" },
];

export const isShippingMode = (value: unknown): value is ShippingMode =>
  value === "free" || value === "fixed" || value === "variable";

/** Stored value -> shipping basis, falling back to shipping_cost when unset. */
export const resolveShippingMode = (
  shippingMode?: string | null,
  shippingCost?: number | null,
): ShippingMode | null => {
  if (isShippingMode(shippingMode)) return shippingMode;
  return Number(shippingCost ?? 0) > 0 ? "fixed" : null;
};

/** Free shipping is only ever true when there is no shipping price. */
export const isFreeShipping = (shippingMode?: string | null, shippingCost?: number | null): boolean =>
  shippingMode === "free" && Number(shippingCost ?? 0) <= 0;

/** False when a listing carries no shipping data at all — then nothing is shown. */
export const hasShippingData = (shippingMode?: string | null, shippingCost?: number | null): boolean =>
  (shippingMode !== undefined && shippingMode !== null && shippingMode !== "") ||
  (shippingCost !== undefined && shippingCost !== null);

/** Product card line: "شحن مجاني" | "شحن: $X" | "حسب شركة الشحن". Null = show nothing. */
export const shippingCardLabel = (
  shippingMode?: string | null,
  shippingCost?: number | null,
  currency?: string | null,
): string | null => {
  if (!hasShippingData(shippingMode, shippingCost)) return null;
  const mode = resolveShippingMode(shippingMode, shippingCost);
  if (mode === null) return "طريقة الشحن غير محددة";
  if (mode === "variable") return "حسب شركة الشحن";
  if (isFreeShipping(shippingMode, shippingCost)) return "شحن مجاني";
  return `شحن: ${formatPrice(shippingCost ?? 0, currency)}`;
};

/** Product page / cart / checkout line, with the "الشحن:" prefix kept for clarity. */
export const shippingDetailLabel = (
  shippingMode?: string | null,
  shippingCost?: number | null,
  currency?: string | null,
): string => {
  const mode = resolveShippingMode(shippingMode, shippingCost);
  if (mode === null) return "طريقة الشحن غير محددة";
  if (mode === "variable") return "الشحن حسب شركة الشحن";
  if (isFreeShipping(shippingMode, shippingCost)) return "شحن مجاني";
  return `الشحن: ${formatPrice(shippingCost ?? 0, currency)}`;
};

/** Shipping amount added to an order: only a fixed price counts as a number. */
export const shippingChargeAmount = (
  shippingMode?: string | null,
  shippingCost?: number | null,
): number => (resolveShippingMode(shippingMode, shippingCost) === "fixed" ? Number(shippingCost ?? 0) : 0);

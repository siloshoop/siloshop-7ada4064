import { supabase } from "@/integrations/supabase/client";

export interface CouponCartItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

export interface CouponQuote {
  id: string;
  code: string;
  vendor_id: string;
  discount_type: string;
  discount_value: number;
  currency: string;
  eligible_subtotal: number;
  discount_amount: number;
  error: string | null;
}

/** Arabic explanation for a rejected coupon quote. */
export const couponErrorMessage = (error: string | null | undefined): string => {
  switch (error) {
    case "NOT_ELIGIBLE":
      return "هذا الكوبون خاص بمنتجات محددة من متجر معيّن، ولا توجد في سلتك منتجات مشمولة به.";
    case "CURRENCY_MISMATCH":
      return "قيمة هذا الكوبون بعملة مختلفة عن عملة المنتجات المشمولة به.";
    case "MIN_PURCHASE":
      return "لم يتحقق الحد الأدنى للشراء من المنتجات المشمولة بالكوبون.";
    case "NOT_STARTED":
      return "هذا الكوبون لم يبدأ بعد.";
    case "USES_EXHAUSTED":
      return "انتهت مرات استخدام هذا الكوبون.";
    case "UNITS_EXHAUSTED":
      return "نفدت الكمية المخصصة للخصم بهذا الكوبون.";
    case "CUSTOMER_LIMIT":
      return "لقد استخدمت هذا الكوبون الحد الأقصى المسموح لك.";
    case "SALE_NOT_COMBINABLE":
      return "المنتجات المشمولة عليها تخفيض حالي، وهذا الكوبون لا يُجمع مع التخفيضات.";
    default:
      return "كود الكوبون غير صحيح أو منتهي الصلاحية.";
  }
};

/** Extracts the reason code from a create_order coupon error message. */
export const couponErrorFromMessage = (message: string): string | null => {
  const m = /Invalid or expired coupon:?\s*([A-Z_]+)?/.exec(message);
  return m ? m[1] ?? "UNKNOWN" : null;
};

const STORAGE_KEY = "siloshop.cart_coupon";

/** The applied code survives cart → checkout navigation and page reloads. */
export const saveAppliedCouponCode = (code: string | null) => {
  try {
    if (code) sessionStorage.setItem(STORAGE_KEY, code.trim().toUpperCase());
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
};

export const loadAppliedCouponCode = (): string | null => {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Server-side quote: discount applies only to the coupon seller's selected
 * products, honours unit/customer limits and sale-combining rules — the same
 * calculation create_order uses when saving the order.
 */
export const quoteCoupon = async (code: string, items: CouponCartItem[]) => {
  const { data, error } = await (supabase.rpc as any)("quote_cart_coupon", {
    _code: code.trim().toUpperCase(),
    _items: items.map((i) => ({
      product_id: i.product_id,
      variant_id: i.variant_id ?? null,
      quantity: i.quantity,
    })),
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as CouponQuote | undefined;
  return row ?? null;
};

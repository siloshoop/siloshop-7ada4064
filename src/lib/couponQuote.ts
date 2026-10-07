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
    default:
      return "كود الكوبون غير صحيح أو منتهي الصلاحية.";
  }
};

/**
 * Server-side quote: the discount applies only to the coupon seller's
 * selected products in the cart (same rule enforced by create_order).
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

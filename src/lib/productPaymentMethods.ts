import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PaymentMethod = "cod" | "sham_cash" | "electronic";

export interface PlatformPaymentOptions {
  cod_enabled: boolean;
  sham_cash_enabled: boolean;
  electronic_payment_enabled: boolean;
  apply_to_all_products: boolean;
}

export interface ProductPaymentFields {
  product_type?: string | null;
  platform_cod_enabled?: boolean | null;
  platform_sham_cash_enabled?: boolean | null;
  platform_electronic_payment_enabled?: boolean | null;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "الدفع عند الاستلام",
  sham_cash: "شام كاش",
  electronic: "الدفع الإلكتروني",
};

/**
 * Payment methods a buyer can actually use for this product. Mirrors
 * create_order: platform products use their own saved choices (falling back
 * to the platform settings when a choice is empty); seller products use the
 * platform settings only when they apply to all products, otherwise COD.
 * Returns null while the platform settings are unknown and needed.
 */
export const productPaymentMethods = (
  product: ProductPaymentFields,
  options: PlatformPaymentOptions | null | undefined,
): PaymentMethod[] | null => {
  const isPlatform = product.product_type === "platform";
  if (!isPlatform) {
    if (options === undefined) return null;
    if (!options?.apply_to_all_products) return ["cod"];
  }
  const needsOptions =
    isPlatform &&
    (product.platform_cod_enabled == null ||
      product.platform_sham_cash_enabled == null ||
      product.platform_electronic_payment_enabled == null);
  if (needsOptions && options === undefined) return null;
  const cod = isPlatform ? product.platform_cod_enabled ?? !!options?.cod_enabled : !!options?.cod_enabled;
  const sham = isPlatform
    ? product.platform_sham_cash_enabled ?? !!options?.sham_cash_enabled
    : !!options?.sham_cash_enabled;
  const elec = isPlatform
    ? product.platform_electronic_payment_enabled ?? !!options?.electronic_payment_enabled
    : !!options?.electronic_payment_enabled;
  return [cod && "cod", sham && "sham_cash", elec && "electronic"].filter(Boolean) as PaymentMethod[];
};

/** Short product-page label, e.g. «الدفع عبر شام كاش». */
export const paymentMethodsLabel = (methods: PaymentMethod[] | null): string | null => {
  if (!methods) return null;
  if (methods.length === 0) return "طريقة الدفع غير متاحة حالياً";
  if (methods.length === 1) {
    const m = methods[0];
    return m === "cod" ? "دفع آمن عند الاستلام" : m === "sham_cash" ? "الدفع عبر شام كاش" : "الدفع الإلكتروني";
  }
  return methods.map((m) => PAYMENT_METHOD_LABELS[m]).join(" أو ");
};

/** Platform payment settings (public RPC); undefined while loading, null when absent. */
export const usePlatformPaymentOptions = () =>
  useQuery({
    queryKey: ["platform-payment-options"],
    queryFn: async (): Promise<PlatformPaymentOptions | null> => {
      const { data, error } = await supabase.rpc("get_platform_payment_options");
      if (error) throw error;
      const o = Array.isArray(data) ? data[0] : (data as any);
      if (!o) return null;
      return {
        cod_enabled: !!o.cod_enabled,
        sham_cash_enabled: !!o.sham_cash_enabled,
        electronic_payment_enabled: !!o.electronic_payment_enabled,
        apply_to_all_products: !!o.apply_to_all_products,
      };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

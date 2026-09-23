/**
 * Product currency helpers.
 *
 * Prices are stored exactly as the seller entered them — there is NO conversion
 * between currencies anywhere in the app. Each product carries its own currency
 * and every price display uses that currency's symbol.
 */

export type ProductCurrency = "SYP" | "USD";

export const DEFAULT_CURRENCY: ProductCurrency = "SYP";

export const CURRENCY_OPTIONS: { value: ProductCurrency; symbol: string; label: string }[] = [
  { value: "SYP", symbol: "ل.س", label: "الليرة السورية (ل.س)" },
  { value: "USD", symbol: "$", label: "الدولار الأمريكي ($)" },
];

/** Symbol for a stored currency code; falls back to the Syrian pound. */
export const currencySymbol = (currency?: string | null): string =>
  currency === "USD" ? "$" : "ل.س";

/** Currency coupons are expressed in: coupon values carry no currency of their own. */
export const COUPON_CURRENCY: ProductCurrency = "SYP";

/** Any stored value -> a supported currency code (defaults to the Syrian pound). */
export const normalizeCurrency = (value?: string | null): ProductCurrency =>
  String(value ?? "").trim().toUpperCase() === "USD" ? "USD" : "SYP";

/** Arabic name of a currency, for labelling per-currency totals. */
export const currencyName = (currency?: string | null): string =>
  normalizeCurrency(currency) === "USD" ? "الدولار الأمريكي" : "الليرة السورية";

export interface CurrencyLine {
  currency: ProductCurrency;
  /** Line price before any discount. */
  lineSubtotal: number;
  /** Quantity-discount savings on this line. */
  savings?: number;
  /** Shipping for this line, in the same currency. */
  shipping?: number;
}

export interface CurrencyTotals {
  currency: ProductCurrency;
  subtotal: number;
  savings: number;
  shipping: number;
  couponDiscount: number;
  tax: number;
  total: number;
}

/**
 * Totals per currency. Amounts in different currencies are NEVER added together
 * and never converted: each currency gets its own independent breakdown.
 */
export const totalsByCurrency = (
  lines: CurrencyLine[],
  options?: { couponDiscount?: number; couponCurrency?: ProductCurrency; taxRate?: number },
): CurrencyTotals[] => {
  const taxRate = options?.taxRate ?? 0;
  const couponCurrency = options?.couponCurrency ?? COUPON_CURRENCY;
  const couponDiscount = Number(options?.couponDiscount || 0);
  const map = new Map<ProductCurrency, CurrencyTotals>();

  for (const line of lines) {
    const currency = normalizeCurrency(line.currency);
    const entry =
      map.get(currency) ??
      {
        currency,
        subtotal: 0,
        savings: 0,
        shipping: 0,
        couponDiscount: 0,
        tax: 0,
        total: 0,
      };
    entry.subtotal += Number(line.lineSubtotal || 0);
    entry.savings += Number(line.savings || 0);
    entry.shipping += Number(line.shipping || 0);
    map.set(currency, entry);
  }

  const result: CurrencyTotals[] = [];
  // Stable order: SYP first, then USD.
  for (const { value } of CURRENCY_OPTIONS) {
    const entry = map.get(value);
    if (!entry) continue;
    entry.couponDiscount =
      entry.currency === couponCurrency ? Math.min(couponDiscount, Math.max(0, entry.subtotal - entry.savings)) : 0;
    const taxable = Math.max(0, entry.subtotal - entry.savings - entry.couponDiscount);
    entry.tax = taxable * taxRate;
    entry.total = taxable + entry.shipping + entry.tax;
    result.push(entry);
  }
  return result;
};

/** "50 $" / "500,000 ل.س" — number formatted, symbol appended. */
export const formatPrice = (
  amount: number | string | null | undefined,
  currency?: string | null,
  options?: { maximumFractionDigits?: number },
): string => {
  const n = Number(amount ?? 0);
  const value = Number.isFinite(n) ? n : 0;
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  })} ${currencySymbol(currency)}`;
};

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

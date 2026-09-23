/**
 * Invoice grouping: order items are grouped by their own currency so that each
 * currency gets its own item table and its own totals. Amounts in different
 * currencies are NEVER added together and never converted.
 */
import { CURRENCY_OPTIONS, normalizeCurrency, type ProductCurrency } from "@/lib/currency";

export interface InvoiceItem {
  currency?: string | null;
  quantity: number;
  price: number | string;
  subtotal?: number | string | null;
  discount_amount?: number | string | null;
  [key: string]: unknown;
}

export interface InvoiceOrderAmounts {
  currency?: string | null;
  subtotal_amount?: number | string | null;
  discount_amount?: number | string | null;
  shipping_amount?: number | string | null;
  tax_amount?: number | string | null;
  total_amount?: number | string | null;
}

export interface InvoiceBlock<T extends InvoiceItem = InvoiceItem> {
  currency: ProductCurrency;
  items: T[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const buildInvoiceBlocks = <T extends InvoiceItem>(
  order: InvoiceOrderAmounts,
  items: T[],
): InvoiceBlock<T>[] => {
  const orderCurrency = normalizeCurrency(order.currency);

  const groups = new Map<ProductCurrency, T[]>();
  for (const item of items) {
    const currency = normalizeCurrency(item.currency ?? order.currency);
    groups.set(currency, [...(groups.get(currency) || []), item]);
  }
  if (groups.size === 0) groups.set(orderCurrency, [] as T[]);

  const single = groups.size === 1;
  const orderShipping = num(order.shipping_amount);
  const orderDiscount = num(order.discount_amount);
  const orderTax = num(order.tax_amount);
  const orderTotal = num(order.total_amount);

  const blocks: InvoiceBlock<T>[] = [];
  // Stable order: SYP first, then USD.
  for (const { value } of CURRENCY_OPTIONS) {
    const list = groups.get(value);
    if (!list) continue;
    const itemsTotal = list.reduce(
      (s, i) => s + (i.subtotal != null ? num(i.subtotal) : num(i.price) * num(i.quantity)),
      0,
    );
    const itemsDiscount = list.reduce((s, i) => s + num(i.discount_amount), 0);
    // Order-level shipping / coupon / tax are recorded in the order currency only.
    const isOrderCurrency = value === orderCurrency;
    const subtotal = single ? num(order.subtotal_amount) || itemsTotal : itemsTotal;
    const discount = isOrderCurrency ? orderDiscount || (single ? itemsDiscount : 0) : 0;
    const shipping = isOrderCurrency ? orderShipping : 0;
    const tax = isOrderCurrency ? orderTax : 0;
    const total =
      single && orderTotal ? orderTotal : Math.max(0, subtotal - discount) + shipping + tax;
    blocks.push({ currency: value, items: list, subtotal, discount, shipping, tax, total });
  }
  return blocks;
};

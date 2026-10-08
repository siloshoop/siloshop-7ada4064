import { supabase } from "@/integrations/supabase/client";
import { formatAmountsByCurrency } from "@/lib/currency";

export interface ReportMoneyRow {
  order_id: string;
  product_id: string | null;
  vendor_id: string | null;
  amount: number;
  unitTotal: number;
  currency: string | null;
  created_at: string;
  status: string;
}

/** Read saved snapshots only; pagination avoids silently truncating financial displays. */
export async function loadReportMoney(from?: string | null, to?: string | null, vendorId?: string, basis: "subtotal" | "unitTotal" = "subtotal"): Promise<ReportMoneyRow[]> {
  const result: ReportMoneyRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabase.from("order_items")
      .select("order_id,product_id,vendor_id,price,quantity,subtotal,currency,orders!inner(created_at,status,currency)")
      .order("id").range(offset, offset + 999);
    if (from) query = query.gte("orders.created_at", from);
    if (to) query = query.lte("orders.created_at", to);
    if (vendorId) query = query.eq("vendor_id", vendorId);
    const { data, error } = await query;
    if (error) throw error;
    for (const row of data ?? []) {
      const order = row.orders;
      result.push({ order_id: row.order_id, product_id: row.product_id, vendor_id: row.vendor_id,
        amount: basis === "unitTotal" ? Number(row.price) * row.quantity : Number(row.subtotal ?? Number(row.price) * row.quantity),
        unitTotal: Number(row.price) * row.quantity, currency: row.currency ?? order.currency,
        created_at: order.created_at, status: order.status });
    }
    if (!data || data.length < 1000) break;
  }
  return result;
}

export function reportMoney(rows: ReportMoneyRow[], filter: (row: ReportMoneyRow) => boolean = () => true): string {
  const selected = rows.filter(filter);
  return formatAmountsByCurrency(selected.map((r) => ({ amount: r.amount, currency: r.currency })));
}

export function reportAverage(rows: { amount: number; currency?: string | null }[]): string {
  return formatAmountsByCurrency(rows, { divideBy: (currency) => rows.filter((r) => String(r.currency ?? "").trim().toUpperCase() === currency).length });
}
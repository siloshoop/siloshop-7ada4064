import { supabase } from "@/integrations/supabase/client";

/** Read-only enrichment for legacy RPCs that omit stored currencies. RLS remains authoritative. */
export async function withDisplayCurrency<T extends { id: string; currency?: string | null }>(
  rows: T[], table: "orders" | "products" | "coupons",
): Promise<(T & { currency: string | null })[]> {
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r.id))];
  const currencies = new Map<string, string | null>();
  for (let start = 0; start < ids.length; start += 200) {
    const { data, error } = await supabase.from(table).select("id,currency").in("id", ids.slice(start, start + 200));
    if (error) throw error;
    for (const row of data ?? []) currencies.set(row.id, row.currency);
  }
  return rows.map((row) => ({ ...row, currency: currencies.get(row.id) ?? row.currency ?? null }));
}
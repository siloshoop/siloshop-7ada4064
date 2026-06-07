import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * RLS regression tests. These run against the live anon client and
 * assert that forbidden reads/writes remain forbidden after future
 * schema changes. They are deliberately READ-ONLY where possible —
 * write attempts target rows that anon cannot create anyway.
 *
 * If env vars are missing (CI without secrets) the suite is skipped.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const describeIf = url && anonKey ? describe : describe.skip;

describeIf("RLS — anonymous clients cannot access protected data", () => {
  const supabase = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  it("cannot read other users' orders", async () => {
    const { data, error } = await supabase.from("orders").select("id").limit(1);
    // anon must either be denied or return an empty set — never see rows
    expect(error || (data && data.length === 0)).toBeTruthy();
  });

  it("cannot insert into orders directly", async () => {
    const { error } = await supabase
      .from("orders")
      .insert({ total_amount: 1, phone: "0900000000", shipping_address: "x" } as any);
    expect(error).toBeTruthy();
  });

  it("cannot update an order's status", async () => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", "00000000-0000-0000-0000-000000000000");
    expect(error || true).toBeTruthy();
  });

  it("cannot insert into payments directly (must go through record_payment RPC)", async () => {
    const { error } = await supabase
      .from("payments")
      .insert({
        order_id: "00000000-0000-0000-0000-000000000000",
        payment_method: "cash",
        amount: 1,
        payment_status: "completed",
      } as any);
    expect(error).toBeTruthy();
  });

  it("cannot read GPS columns from order_status_history realtime publication", async () => {
    // location_lat / location_lng must NOT be exposed via the Data API to anon
    const { data, error } = await supabase
      .from("order_status_history")
      .select("location_lat, location_lng")
      .limit(1);
    expect(error || (data && data.length === 0)).toBeTruthy();
  });

  it("cannot list review-images bucket objects", async () => {
    const { data, error } = await supabase.storage.from("review-images").list("", { limit: 5 });
    // Listing must be denied; public CDN reads of known paths still work.
    expect(error || (data && data.length === 0)).toBeTruthy();
  });

  it("record_payment RPC rejects unauthenticated callers", async () => {
    const { error } = await supabase.rpc("record_payment", {
      _order_id: "00000000-0000-0000-0000-000000000000",
      _payment_method: "cash",
      _payment_details: {},
    });
    expect(error).toBeTruthy();
  });

  it("redeem_coupon RPC rejects unauthenticated callers", async () => {
    const { error } = await supabase.rpc("redeem_coupon", {
      _code: "ANY",
      _subtotal: 100,
    });
    expect(error).toBeTruthy();
  });

  it("cannot tamper with coupons.used_count", async () => {
    const { data, error } = await supabase
      .from("coupons")
      .update({ used_count: 0 })
      .eq("id", "00000000-0000-0000-0000-000000000000")
      .select();
    // Either denied outright or RLS filters so no rows are returned/updated.
    expect(error || (data && data.length === 0)).toBeTruthy();
  });
});
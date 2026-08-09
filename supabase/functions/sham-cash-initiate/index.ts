// Starts a Sham Cash payment for a platform order (PHASE 2 — inactive).
// Returns 503 while the `sham_cash_payments` feature flag is off. Merchant
// credentials are read from backend secrets only, never from the database.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BodySchema = z.object({ order_id: z.string().uuid() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
  const userId = claimsData.claims.sub as string;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: flagEnabled } = await admin.rpc("is_feature_enabled", {
    _key: "sham_cash_payments",
  });
  if (flagEnabled !== true) return json({ error: "SHAM_CASH_DISABLED" }, 503);

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: parsed.error.flatten().fieldErrors }, 400);
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, customer_id, total_amount, order_kind, payment_method")
    .eq("id", parsed.data.order_id)
    .maybeSingle();

  if (!order || order.customer_id !== userId) return json({ error: "Order not found" }, 404);
  if (order.order_kind !== "platform" || order.payment_method !== "sham_cash") {
    return json({ error: "Order is not a Sham Cash order" }, 400);
  }

  const merchantId = Deno.env.get("SHAM_CASH_MERCHANT_ID");
  const apiKey = Deno.env.get("SHAM_CASH_API_KEY");
  if (!merchantId || !apiKey) {
    return json({ error: "SHAM_CASH_NOT_CONFIGURED" }, 503);
  }

  const { data: config } = await admin
    .from("sham_cash_merchant_config")
    .select("api_base_url, callback_url, environment, is_active")
    .eq("id", 1)
    .maybeSingle();
  if (!config?.is_active) return json({ error: "SHAM_CASH_DISABLED" }, 503);

  const idempotencyKey = `sham:${order.id}`;
  const { data: txn, error: txnError } = await admin
    .from("payment_transactions")
    .upsert(
      {
        order_id: order.id,
        provider: "sham_cash",
        amount: order.total_amount,
        currency: "SYP",
        status: "processing",
        idempotency_key: idempotencyKey,
      },
      { onConflict: "idempotency_key" },
    )
    .select("id, status, provider_reference")
    .maybeSingle();
  if (txnError) return json({ error: "Failed to create transaction" }, 500);

  // Provider call is intentionally left as the single integration point to fill
  // in when the merchant account goes live; everything around it is ready.
  return json({
    ok: true,
    transaction_id: txn?.id,
    environment: config.environment,
    checkout_url: null,
    message: "Sham Cash transaction registered. Awaiting provider confirmation.",
  });
});

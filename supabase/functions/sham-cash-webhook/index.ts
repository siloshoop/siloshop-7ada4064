// Sham Cash payment webhook (PHASE 2 — inactive until the `sham_cash_payments`
// feature flag is enabled). Verifies an HMAC signature using backend secrets,
// logs every event, and settles the matching order/payment atomically.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const hmacHex = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Feature gate: refuse to process anything while Sham Cash is disabled.
  const { data: flagEnabled } = await admin.rpc("is_feature_enabled", {
    _key: "sham_cash_payments",
  });
  if (flagEnabled !== true) return json({ error: "SHAM_CASH_DISABLED" }, 503);

  const raw = await req.text();
  const secret = Deno.env.get("SHAM_CASH_WEBHOOK_SECRET");
  const provided = req.headers.get("x-sham-signature") ?? "";
  let signatureValid = false;
  if (secret && provided) {
    signatureValid = timingSafeEqual(provided.toLowerCase(), await hmacHex(secret, raw));
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = {};
  }

  const eventId = String(payload.event_id ?? payload.id ?? crypto.randomUUID());
  const eventType = String(payload.event_type ?? payload.status ?? "unknown");
  const orderId = typeof payload.order_id === "string" ? payload.order_id : null;
  const reference =
    typeof payload.transaction_id === "string" ? payload.transaction_id : null;
  const amountRaw = payload.amount;
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : typeof amountRaw === "string" && amountRaw.trim() !== "" && !isNaN(Number(amountRaw))
        ? Number(amountRaw)
        : null;
  const currency = typeof payload.currency === "string" ? payload.currency : "SYP";
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Idempotent event log (unique on provider + event_id).
  const { error: logError } = await admin.from("payment_webhook_events").insert({
    provider: "sham_cash",
    event_id: eventId,
    event_type: eventType,
    signature_valid: signatureValid,
    payload,
  });
  if (logError && !logError.message.includes("duplicate")) {
    console.error("webhook log failed", logError.message);
  }
  if (logError?.message.includes("duplicate")) {
    return json({ ok: true, duplicate: true });
  }

  if (!signatureValid) {
    await admin
      .from("payment_webhook_events")
      .update({ error_message: "invalid signature" })
      .eq("provider", "sham_cash")
      .eq("event_id", eventId);
    return json({ error: "Invalid signature" }, 401);
  }

  const succeeded = ["succeeded", "paid", "completed"].includes(eventType.toLowerCase());

  if (!orderId || !uuidRe.test(orderId)) {
    await admin
      .from("payment_webhook_events")
      .update({ error_message: "invalid or missing order_id" })
      .eq("provider", "sham_cash")
      .eq("event_id", eventId);
    return json({ error: "Invalid order_id" }, 400);
  }

  // All settlement logic (amount + currency + order-kind verification, payment
  // and order updates, one status-history row, one notification) happens inside
  // a single locked transaction in the database. A mismatching or forged
  // payload can never mark an order as paid.
  const { data: settlement, error: settleError } = await admin.rpc(
    "settle_sham_cash_payment",
    {
      _order_id: orderId,
      _succeeded: succeeded,
      _provider_reference: reference,
      _amount: amount,
      _currency: currency,
      _failure_reason: succeeded ? null : eventType,
    },
  );

  if (settleError) {
    // Never log provider secrets — only the failure message.
    console.error("settlement failed", settleError.message);
    await admin
      .from("payment_webhook_events")
      .update({ error_message: settleError.message })
      .eq("provider", "sham_cash")
      .eq("event_id", eventId);
    return json({ error: "Settlement failed" }, 500);
  }

  const result = (settlement ?? {}) as { ok?: boolean; reason?: string; status?: string };

  await admin
    .from("payment_transactions")
    .update({ provider_payload: payload })
    .eq("order_id", orderId)
    .eq("provider", "sham_cash");

  if (result.ok !== true) {
    await admin
      .from("payment_webhook_events")
      .update({ error_message: result.reason ?? "rejected" })
      .eq("provider", "sham_cash")
      .eq("event_id", eventId);
    return json({ error: result.reason ?? "rejected" }, 400);
  }

  await admin
    .from("payment_webhook_events")
    .update({ processed: true })
    .eq("provider", "sham_cash")
    .eq("event_id", eventId);

  return json({ ok: true, status: result.status ?? (succeeded ? "paid" : "failed") });
});

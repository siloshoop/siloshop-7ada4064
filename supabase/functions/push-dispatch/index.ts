// Delivers one in-app notification as a phone (Android/iOS) or browser push via
// Firebase Cloud Messaging. Called by the notifications insert trigger with only
// a notification id; the row is claimed once (push_sent_at), so repeated or
// outside calls can never send twice, send old alerts, or choose the content.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  isPushNotificationType,
  notificationTarget,
  ORDER_UPDATE_TYPES,
} from "../_shared/notificationRoutes.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const SITE = "https://www.siloshop.net";
const MAX_AGE_MS = 15 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clip = (s: string | null | undefined, n: number) => {
  const v = (s ?? "").trim();
  return v.length > n ? `${v.slice(0, n - 1)}…` : v;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let id: unknown;
  try {
    id = (await req.json())?.notification_id;
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (typeof id !== "string" || !UUID.test(id)) return json({ error: "invalid_notification_id" }, 400);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const FCM_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY");
  if (!LOVABLE_API_KEY || !FCM_KEY) return json({ error: "push_not_configured" }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Claim the notification exactly once, and only while it is fresh.
  const { data: n, error: claimErr } = await admin
    .from("notifications")
    .update({ push_sent_at: new Date().toISOString() })
    .eq("id", id)
    .is("push_sent_at", null)
    .gte("created_at", new Date(Date.now() - MAX_AGE_MS).toISOString())
    .select("id, user_id, title, message, type, related_id")
    .maybeSingle();
  if (claimErr) {
    console.error("claim failed", claimErr);
    return json({ error: "claim_failed" }, 500);
  }
  if (!n) return json({ skipped: "not_pending" });
  if (!isPushNotificationType(n.type)) return json({ skipped: "type" });

  if (ORDER_UPDATE_TYPES.includes(n.type)) {
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("order_updates")
      .eq("user_id", n.user_id)
      .maybeSingle();
    if (prefs && prefs.order_updates === false) return json({ skipped: "preference" });
  }

  const { data: devices, error: devErr } = await admin
    .from("push_devices")
    .select("id, token, platform")
    .eq("user_id", n.user_id);
  if (devErr) {
    console.error("devices read failed", devErr);
    return json({ error: "devices_failed" }, 500);
  }
  if (!devices?.length) return json({ skipped: "no_devices" });

  const title = clip(n.title, 120) || "SiloShop";
  const body = clip(n.message, 400);
  const path = notificationTarget(n.type, n.related_id) ?? "/notifications";

  const headers = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": FCM_KEY,
    "Content-Type": "application/json",
  };

  let sent = 0;
  const stale: string[] = [];
  const failures: { status: number; body: string }[] = [];

  for (const d of devices) {
    const message =
      d.platform === "web"
        ? {
            token: d.token,
            // Data-only: the site's own push worker shows it (RTL, icon, tap target).
            data: { title, body, url: path, tag: n.id },
            webpush: { headers: { Urgency: "high", TTL: "86400" } },
          }
        : {
            token: d.token,
            notification: { title, body },
            data: { url: path, notification_id: n.id },
            android: {
              priority: "HIGH",
              notification: { channel_id: "siloshop_alerts", sound: "default", tag: n.id },
            },
            apns: { payload: { aps: { sound: "default" } } },
          };

    const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message }),
    });
    if (res.ok) {
      sent++;
      await res.body?.cancel();
      continue;
    }
    const text = await res.text();
    if (res.status === 404 || (res.status === 400 && /UNREGISTERED|registration token|INVALID_ARGUMENT/i.test(text))) {
      stale.push(d.id);
    } else {
      console.error(`FCM send failed [${res.status}]: ${text}`);
      failures.push({ status: res.status, body: text.slice(0, 500) });
    }
  }

  if (stale.length) await admin.from("push_devices").delete().in("id", stale);

  return json({ sent, removed: stale.length, failed: failures.length, failures, link: `${SITE}${path}` });
});

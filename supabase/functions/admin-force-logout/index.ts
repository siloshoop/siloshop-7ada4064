// Force-logout a user: revokes all their refresh tokens.
// Only callable by an admin / super_admin (verified server-side).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return json({ error: "unauthorized" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) return json({ error: "unauthorized" }, 401);

  const { data: isAdmin } = await admin.rpc("has_any_admin_role", { _user_id: caller.user.id });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let userId: string | undefined;
  try {
    ({ user_id: userId } = await req.json());
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "invalid_user_id" }, 400);
  if (userId === caller.user.id) return json({ error: "cannot_target_self" }, 400);

  const res = await fetch(`${url}/auth/v1/admin/users/${userId}/logout`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok && res.status !== 204) {
    return json({ error: "logout_failed", status: res.status }, 502);
  }

  await admin.rpc("log_admin_action", {
    _action: "force_logout",
    _target_type: "auth_user",
    _target_id: userId,
    _old_value: null,
    _new_value: null,
    _reason: null,
  }).catch(() => {});

  return json({ success: true });
});

// Force-logout a user: revokes all their refresh tokens.
// Only callable by an admin / super_admin (verified server-side).
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "server_configuration_error" }, 500);
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return json({ error: "unauthorized" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) return json({ error: "unauthorized" }, 401);

  const { data: isAdmin, error: roleError } = await admin.rpc("has_any_admin_role", { _user_id: caller.user.id });
  if (roleError) return json({ error: "authorization_check_failed" }, 500);
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
    // Opaque server keys identify through apikey. Sending one as a bearer token
    // makes the Auth service treat it as an invalid user JWT.
    headers: { apikey: serviceKey },
  });
  if (!res.ok && res.status !== 204) {
    return json({ error: "logout_failed", status: res.status }, 502);
  }

  const { error: auditError } = await admin.from("admin_audit_log").insert({
    actor_id: caller.user.id,
    action: "force_logout",
    target_type: "auth_user",
    target_id: userId,
  });
  if (auditError) return json({ error: "audit_log_failed" }, 500);

  return json({ success: true });
});

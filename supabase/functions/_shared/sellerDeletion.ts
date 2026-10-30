import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { runDeletion, type DeletionJob, type DeletionScope } from "./deletionWorkflow.ts";

const requestSchema = z.object({
  confirmation: z.literal("حذف"),
  password: z.string().min(1).max(1024),
  target_user_id: z.string().uuid().optional(),
}).strict();

export async function handleSellerDeletion(req: Request, scope: DeletionScope) {
  const reply = (body: object, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return reply({ error: "unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key || !serviceKey) return reply({ error: "service_unavailable" }, 503);
    const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: identity, error: identityError } = await auth.auth.getUser(token);
    if (identityError || !identity.user?.email) return reply({ error: "unauthorized" }, 401);
    const parsed = requestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return reply({ error: "confirmation_required" }, 400);
    // Reauthentication is enforced on the server, not only by a disabled button.
    // This publishable client is separate from the privileged cleanup client.
    const { data: reauth, error: reauthError } = await auth.auth.signInWithPassword({
      email: identity.user.email, password: parsed.data.password,
    });
    if (reauthError || reauth.user?.id !== identity.user.id) return reply({ error: "invalid_password" }, 403);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    let uid = identity.user.id;
    if (parsed.data.target_user_id && parsed.data.target_user_id !== uid) {
      // Existing owner/admin store management only; moderators never gain deletion.
      if (scope !== "store") return reply({ error: "forbidden" }, 403);
      const { data: roles, error } = await admin.from("user_roles").select("role").eq("user_id", uid).in("role", ["admin", "super_admin"]);
      if (error || !roles?.length) return reply({ error: "forbidden" }, 403);
      uid = parsed.data.target_user_id;
    }
    await runDeletion(scope, {
      prepare: async () => {
        const { data, error } = await admin.rpc("prepare_seller_deletion", { _uid: uid, _scope: scope });
        if (error) throw new Error(error.message);
        return data as DeletionJob;
      },
      removeAssets: async (bucket, paths) => {
        const { error } = await admin.storage.from(bucket).remove(paths);
        if (error) throw new Error("storage_cleanup_failed");
      },
      finishDatabase: async () => {
        const { error } = await admin.rpc("finish_seller_deletion", { _uid: uid, _scope: scope });
        if (error) throw new Error(error.message);
      },
      deleteAuth: async () => {
        const { error } = await admin.auth.admin.deleteUser(uid, false);
        if (error) throw new Error("auth_delete_failed");
      },
      complete: async () => {
        // No PII inventory survives successful deletion. Store jobs are cleared
        // so the remaining buyer account can apply for a new store later.
        const { error } = await admin.from("seller_deletion_jobs").delete().eq("user_id", uid);
        if (error) throw new Error("completion_failed");
      },
    });
    return reply({ success: true, scope });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    const codes = ["open_orders", "retention_review_required", "staff_account", "store_not_found", "deletion_in_progress", "storage_cleanup_failed", "auth_delete_failed", "completion_failed"];
    const code = codes.find((c) => message.includes(c)) ?? "database_cleanup_failed";
    // Stable codes only: never log passwords, tokens, or personal records.
    console.error("seller deletion failed", { scope, code });
    return reply({ error: code }, ["open_orders", "retention_review_required", "deletion_in_progress", "staff_account"].includes(code) ? 409 : 500);
  }
}
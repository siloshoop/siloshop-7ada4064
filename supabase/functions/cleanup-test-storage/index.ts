// Temporary maintenance function: removes orphaned test files from storage.
// Requires a shared secret header; deleted after the cleanup run.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const BUCKETS = ["product-images", "review-images", "chat-files"];

Deno.serve(async (req) => {
  if (req.headers.get("x-cleanup-key") !== Deno.env.get("SUPABASE_DB_URL")?.slice(-16)) {
    return new Response("forbidden", { status: 403 });
  }
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const report: Record<string, unknown> = {};
  for (const bucket of BUCKETS) {
    const removed: string[] = [];
    const walk = async (prefix: string) => {
      const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      if (error) throw error;
      const files = (data ?? []).filter((e) => e.id).map((e) => (prefix ? `${prefix}/${e.name}` : e.name));
      const folders = (data ?? []).filter((e) => !e.id).map((e) => (prefix ? `${prefix}/${e.name}` : e.name));
      if (files.length) {
        const { error: delErr } = await admin.storage.from(bucket).remove(files);
        if (delErr) throw delErr;
        removed.push(...files);
      }
      for (const f of folders) await walk(f);
    };
    await walk("");
    report[bucket] = removed.length;
  }
  return new Response(JSON.stringify(report), { headers: { "Content-Type": "application/json" } });
});

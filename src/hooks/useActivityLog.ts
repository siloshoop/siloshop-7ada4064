import { supabase } from "@/integrations/supabase/client";

/**
 * Log a user activity via the `log_activity` SECURITY DEFINER RPC.
 * Fails silently so audit logging never blocks the user flow.
 */
export async function logActivity(
  _userId: string,
  actionType: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.rpc("log_activity", {
      _action_type: actionType,
      _action_details: details,
      _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[logActivity] failed:", err);
  }
}
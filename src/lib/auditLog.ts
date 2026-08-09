import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget audit trail for privileged (admin) actions.
 * Writes go through the `log_activity` security-definer RPC, which stamps
 * auth.uid() server-side — the caller cannot forge the actor.
 * Failures never block the UI action that triggered them.
 */
export const logAdminAction = async (
  actionType: string,
  details: Record<string, unknown> = {},
): Promise<void> => {
  try {
    await supabase.rpc("log_activity", {
      _action_type: actionType,
      _action_details: details as never,
      _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    /* audit logging must never break the user-facing action */
  }
};

export default logAdminAction;
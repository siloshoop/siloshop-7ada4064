import { supabase } from "@/integrations/supabase/client";

type ActionType = 
  | "login" 
  | "logout" 
  | "signup" 
  | "order_created" 
  | "order_updated" 
  | "product_created" 
  | "product_updated" 
  | "product_deleted"
  | "profile_updated"
  | "user_banned"
  | "user_unbanned"
  | "role_added"
  | "role_removed";

interface ActionDetails {
  [key: string]: any;
}

export const logActivity = async (
  userId: string,
  actionType: ActionType,
  actionDetails: ActionDetails = {}
) => {
  try {
    const { error } = await supabase.rpc('log_activity', {
      _action_type: actionType,
      _action_details: actionDetails,
      _user_agent: navigator.userAgent,
    });

    if (error) {
      console.error("Failed to log activity:", error);
    }
  } catch (error) {
    console.error("Activity log error:", error);
  }
};

export const useActivityLog = () => {
  return { logActivity };
};

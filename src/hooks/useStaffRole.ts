import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const useStaffRole = () => {
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: ["staff-role", user?.id],
    enabled: !!user && !loading,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.rpc("actor_admin_role", { _user_id: user.id });
      if (error) throw error;
      return data === "admin" || data === "super_admin" || data === "moderator" ? data : null;
    },
    staleTime: 0,
  });
  return { role: query.data ?? null, loading: loading || (!!user && query.isPending) };
};
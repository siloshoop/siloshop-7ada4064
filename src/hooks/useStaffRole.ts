import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { resolveStaffRole } from "@/lib/staffRole";

export const useStaffRole = () => {
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: ["staff-role", user?.id],
    enabled: !!user && !loading,
    queryFn: async () => {
      if (!user) return null;
      return resolveStaffRole((role) => supabase.rpc("has_role", { _user_id: user.id, _role: role }));
    },
    staleTime: 0,
    retry: 1,
  });
  return { role: query.data ?? null, loading: loading || (!!user && query.isPending), error: query.error, retry: query.refetch };
};
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { hasPermission } from "@/lib/adminPermissions";
export const useStaffPermissions = () => {
  const { user, loading } = useAuth();
  const query = useQuery({ queryKey: ["staff-permissions", user?.id], enabled: !!user && !loading,
    queryFn: async () => { const { data, error } = await supabase.rpc("get_my_staff_permissions"); if (error) throw error; return data ?? []; },
    staleTime: 0, refetchOnWindowFocus: true,
  });
  return { permissions: query.data ?? [], can: (key: string) => hasPermission(query.data ?? [], key), loading: loading || (!!user && query.isPending), error: query.error };
};
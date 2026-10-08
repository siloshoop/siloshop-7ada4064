import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  id: string;
  name_ar: string;
  icon: string | null;
}

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name_ar, icon")
        .eq("is_active", true)
        .order("name_ar");
      if (error) throw error;
      return data as Category[];
    },
    staleTime: 5 * 60_000, // 5 minutes
  });
};

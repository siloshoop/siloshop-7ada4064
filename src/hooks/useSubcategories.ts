import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Subcategory {
  id: string;
  category_id: string;
  name_ar: string;
  icon: string | null;
}

export const useSubcategories = () => {
  return useQuery({
    queryKey: ["subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcategories")
        .select("id, category_id, name_ar, icon")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Subcategory[];
    },
    staleTime: 5 * 60_000,
  });
};

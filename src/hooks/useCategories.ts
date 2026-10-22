import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  id: string;
  name_ar: string;
  icon: string | null;
  color: string | null;
  image_url: string | null;
  sort_order: number;
}

export const useCategories = (enabled = true) => {
  return useQuery({
    queryKey: ["public-navigation", "categories"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name_ar, icon, color, image_url, sort_order")
        .eq("is_active", true)
        .order("sort_order").order("name_ar");
      if (error) throw error;
      return data as Category[];
    },
    staleTime: 5 * 60_000, // 5 minutes
  });
};

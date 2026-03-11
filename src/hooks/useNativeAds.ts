import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NativeAd {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_text: string;
  cta_url: string | null;
  sponsor_name: string;
  placement: string;
  priority: number;
}

export const useNativeAds = (placement: string) => {
  return useQuery({
    queryKey: ["native-ads", placement],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("native_ads")
        .select("id, title, description, image_url, cta_text, cta_url, sponsor_name, placement, priority")
        .eq("placement", placement)
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as NativeAd[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useRecentlyViewed = () => {
  const { user } = useAuth();

  // Stable identity: consumers use this in effect dependency arrays, and a new
  // function on every render would re-trigger those effects in a loop.
  const trackProductView = useCallback(async (productId: string) => {
    if (!user) return;

    try {
      // Upsert the recently viewed record (update viewed_at if exists, insert if not)
      const { error } = await supabase
        .from("recently_viewed")
        .upsert(
          {
            user_id: user.id,
            product_id: productId,
            viewed_at: new Date().toISOString()
          },
          {
            onConflict: "user_id,product_id"
          }
        );

      if (error) {
        console.error("Error tracking product view:", error);
      }

      // Cleanup: Keep only the last 50 viewed products
      const { data: allViewed } = await supabase
        .from("recently_viewed")
        .select("id, viewed_at")
        .eq("user_id", user.id)
        .order("viewed_at", { ascending: false });

      if (allViewed && allViewed.length > 50) {
        const idsToDelete = allViewed.slice(50).map(v => v.id);
        await supabase
          .from("recently_viewed")
          .delete()
          .in("id", idsToDelete);
      }
    } catch (error) {
      console.error("Error in trackProductView:", error);
    }
  }, [user?.id]);

  return { trackProductView };
};

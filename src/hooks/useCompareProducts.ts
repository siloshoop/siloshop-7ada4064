import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const MAX_PRODUCTS = 4;
const UPDATED_EVENT = "compare-products-updated";

/**
 * Product comparison list.
 *
 * Persisted in the `compare_items` table so the list follows the account across
 * devices. The 4-product cap is enforced by a database trigger as well; guests
 * are prompted to sign in via the `requiresAuth` flag.
 */
export const useCompareProducts = () => {
  const [compareProducts, setCompareProducts] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (uid: string | null) => {
    if (!uid) {
      setCompareProducts([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("compare_items")
      .select("product_id")
      .order("created_at", { ascending: true });
    setCompareProducts(data?.map((row) => row.product_id) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      void load(uid);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      void load(uid);
    });

    const sync = () => {
      void supabase.auth.getSession().then(({ data }) => load(data.session?.user?.id ?? null));
    };
    window.addEventListener(UPDATED_EVENT, sync);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener(UPDATED_EVENT, sync);
    };
  }, [load]);

  const addProduct = useCallback(
    async (productId: string): Promise<{ success: boolean; message: string }> => {
      if (!userId) return { success: false, message: "auth" };
      if (compareProducts.includes(productId)) return { success: false, message: "exists" };
      if (compareProducts.length >= MAX_PRODUCTS) return { success: false, message: "max" };

      const { error } = await supabase
        .from("compare_items")
        .insert({ user_id: userId, product_id: productId });

      if (error) {
        return {
          success: false,
          message: error.message.includes("compare_limit_reached") ? "max" : "error",
        };
      }

      setCompareProducts((prev) => [...prev, productId]);
      window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
      return { success: true, message: "added" };
    },
    [compareProducts, userId],
  );

  const removeProduct = useCallback(
    async (productId: string) => {
      if (!userId) return;
      setCompareProducts((prev) => prev.filter((id) => id !== productId));
      await supabase.from("compare_items").delete().eq("user_id", userId).eq("product_id", productId);
      window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
    },
    [userId],
  );

  const clearProducts = useCallback(async () => {
    if (!userId) return;
    setCompareProducts([]);
    await supabase.from("compare_items").delete().eq("user_id", userId);
    window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
  }, [userId]);

  const isInCompare = useCallback(
    (productId: string) => compareProducts.includes(productId),
    [compareProducts],
  );

  return {
    compareProducts,
    compareCount: compareProducts.length,
    loading,
    requiresAuth: !userId,
    addProduct,
    removeProduct,
    clearProducts,
    isInCompare,
  };
};

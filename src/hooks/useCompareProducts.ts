import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const MAX_PRODUCTS = 4;
const UPDATED_EVENT = "compare-products-updated";
const GUEST_KEY = "siloshop_compare_guest";

const readGuest = (): string[] => {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as string[]).slice(0, MAX_PRODUCTS) : [];
  } catch {
    return [];
  }
};

const writeGuest = (ids: string[]) => {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(ids.slice(0, MAX_PRODUCTS)));
  } catch {
    /* storage unavailable */
  }
};

/**
 * Product comparison list.
 *
 * Signed-in users persist the list in `compare_items` so it follows the account
 * across devices; guests keep it in localStorage and it is merged into their
 * account on sign-in. The 4-product cap is enforced by a database trigger too.
 */
export const useCompareProducts = () => {
  const [compareProducts, setCompareProducts] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (uid: string | null) => {
    if (!uid) {
      setCompareProducts(readGuest());
      setLoading(false);
      return;
    }
    // Merge any list the visitor built before signing in.
    const pending = readGuest();
    if (pending.length) {
      await supabase
        .from("compare_items")
        .upsert(
          pending.map((product_id) => ({ user_id: uid, product_id })),
          { onConflict: "user_id,product_id", ignoreDuplicates: true },
        );
      writeGuest([]);
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
      if (compareProducts.includes(productId)) return { success: false, message: "exists" };
      if (compareProducts.length >= MAX_PRODUCTS) return { success: false, message: "max" };

      if (!userId) {
        const next = [...compareProducts, productId];
        writeGuest(next);
        setCompareProducts(next);
        window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
        return { success: true, message: "added" };
      }

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
      setCompareProducts((prev) => {
        const next = prev.filter((id) => id !== productId);
        if (!userId) writeGuest(next);
        return next;
      });
      if (userId) {
        await supabase.from("compare_items").delete().eq("user_id", userId).eq("product_id", productId);
      }
      window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
    },
    [userId],
  );

  const clearProducts = useCallback(async () => {
    setCompareProducts([]);
    if (!userId) {
      writeGuest([]);
    } else {
      await supabase.from("compare_items").delete().eq("user_id", userId);
    }
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
    requiresAuth: false,

    addProduct,
    removeProduct,
    clearProducts,
    isInCompare,
  };
};

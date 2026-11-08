import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

// Every product card uses this hook, so a listing of 20 cards used to send 20
// identical reads (and 20 more after each change). Hooks that load at the same
// moment now share one in-flight read; finished results are never reused, so the
// next mount or change still reads the saved list fresh.
const inflightLoads = new Map<string, Promise<string[]>>();

export const loadAccountCompareList = (uid: string): Promise<string[]> => {
  const existing = inflightLoads.get(uid);
  if (existing) return existing;
  const request = (async () => {
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
    return data?.map((row) => row.product_id) ?? [];
  })().finally(() => {
    inflightLoads.delete(uid);
  });
  inflightLoads.set(uid, request);
  return request;
};

/** A change was saved: drop reads that started before it, then tell every list. */
const announceCompareChange = () => {
  inflightLoads.clear();
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
};

/**
 * Product comparison list.
 *
 * Signed-in users persist the list in `compare_items` so it follows the account
 * across devices; guests keep it in localStorage and it is merged into their
 * account on sign-in. The 4-product cap is enforced by a database trigger too.
 */
export const useCompareProducts = () => {
  const { user, loading: authLoading } = useAuth();
  const [compareProducts, setCompareProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = user?.id ?? null;

  const load = useCallback(async (uid: string | null) => {
    if (!uid) {
      setCompareProducts(readGuest());
      setLoading(false);
      return;
    }
    const ids = await loadAccountCompareList(uid);
    setCompareProducts(ids);
    setLoading(false);
  }, []);


  useEffect(() => {
    if (authLoading) return;
    void load(userId);

    const sync = () => {
      void load(userId);
    };
    window.addEventListener(UPDATED_EVENT, sync);

    return () => {
      window.removeEventListener(UPDATED_EVENT, sync);
    };
  }, [authLoading, load, userId]);

  const addProduct = useCallback(
    async (productId: string): Promise<{ success: boolean; message: string }> => {
      if (compareProducts.includes(productId)) return { success: false, message: "exists" };
      if (compareProducts.length >= MAX_PRODUCTS) return { success: false, message: "max" };

      if (!userId) {
        const next = [...compareProducts, productId];
        writeGuest(next);
        setCompareProducts(next);
        announceCompareChange();
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
      announceCompareChange();
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
      announceCompareChange();
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
    announceCompareChange();
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

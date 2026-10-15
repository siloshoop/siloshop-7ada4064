import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSyncListener } from "@/lib/uiSync";

/**
 * Shared cart item count. Pass the user id when available (useAuth);
 * when omitted, the current auth user is resolved per fetch.
 */
export const useCartCount = (userId?: string | null) => {
  const [count, setCount] = useState(0);
  const [bounce, setBounce] = useState(false);
  const prevRef = useRef(0);

  const fetchCartCount = useCallback(async () => {
    let uid = userId;
    if (uid === undefined) {
      const { data } = await supabase.auth.getUser();
      uid = data?.user?.id ?? null;
    }
    if (!uid) {
      prevRef.current = 0;
      setCount(0);
      return;
    }

    const { data, error } = await supabase
      .from("cart_items")
      .select("quantity")
      .eq("user_id", uid);

    if (error) {
      console.error("Error fetching cart count:", error);
      return;
    }

    const totalItems = (data || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
    if (totalItems !== prevRef.current && totalItems > 0) {
      setBounce(true);
      setTimeout(() => setBounce(false), 500);
    }
    prevRef.current = totalItems;
    setCount(totalItems);
  }, [userId]);

  useEffect(() => {
    fetchCartCount();
  }, [fetchCartCount]);

  useSyncListener(["cart"], fetchCartCount);

  return { count, bounce, fetchCartCount };
};

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SellerStatus = "none" | "pending" | "approved" | "rejected" | "suspended";

export interface SellerStatusState {
  status: SellerStatus;
  rejectionReason: string | null;
  isVendor: boolean;
  loading: boolean;
  refresh: () => void;
}

/**
 * Single source of truth for the current user's seller (vendor) eligibility.
 * Reused by the route gate, the seller layout and the dashboard banners.
 */
export const useSellerStatus = (): SellerStatusState => {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<SellerStatus>("none");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isVendor, setIsVendor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStatus("none");
      setIsVendor(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: profile }, { data: app }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        supabase
          .from("seller_applications")
          .select("status, rejection_reason")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setIsVendor(profile?.role === "vendor");
      setStatus((app?.status as SellerStatus) ?? "none");
      setRejectionReason(app?.rejection_reason ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, tick]);

  return { status, rejectionReason, isVendor, loading, refresh };
};

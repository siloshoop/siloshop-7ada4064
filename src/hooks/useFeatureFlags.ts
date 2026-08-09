import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Feature flags let Phase 2 capabilities (Platform Marketplace / Sham Cash)
 * ship fully built but disabled. Flags live in the `feature_flags` table and
 * are ALSO enforced server-side (RLS + create_order), so the UI gating here is
 * purely presentational.
 */
export type FeatureFlagKey = "platform_marketplace" | "sham_cash_payments";

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  label_ar: string;
  description: string | null;
}

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("feature_flags")
      .select("key, enabled, label_ar, description")
      .order("key");
    const list = (data ?? []) as FeatureFlag[];
    setRows(list);
    setFlags(Object.fromEntries(list.map((f) => [f.key, f.enabled])));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isEnabled = useCallback(
    (key: FeatureFlagKey) => flags[key] === true,
    [flags]
  );

  return { flags, rows, loading, isEnabled, reload: load };
};

export default useFeatureFlags;

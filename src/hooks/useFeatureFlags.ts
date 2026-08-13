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

/**
 * Flags are identical for every consumer, so the fetch is shared process-wide.
 * Without this, each mounted component issued its own request (the homepage
 * alone fired 37 identical `feature_flags` queries).
 */
let cache: FeatureFlag[] | null = null;
let inflight: Promise<FeatureFlag[]> | null = null;
const listeners = new Set<(rows: FeatureFlag[]) => void>();

const fetchFlags = (force = false): Promise<FeatureFlag[]> => {
  if (!force && cache) return Promise.resolve(cache);
  if (!force && inflight) return inflight;
  inflight = supabase
    .from("feature_flags")
    .select("key, enabled, label_ar, description")
    .order("key")
    .then(({ data }) => {
      cache = (data ?? []) as FeatureFlag[];
      inflight = null;
      listeners.forEach((fn) => fn(cache as FeatureFlag[]));
      return cache;
    });
  return inflight;
};

export const useFeatureFlags = () => {
  const [rows, setRows] = useState<FeatureFlag[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchFlags(true);
    setRows(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    const onUpdate = (list: FeatureFlag[]) => setRows(list);
    listeners.add(onUpdate);
    void fetchFlags().then((list) => {
      setRows(list);
      setLoading(false);
    });
    return () => {
      listeners.delete(onUpdate);
    };
  }, []);

  const flags = useMemo(
    () => Object.fromEntries(rows.map((f) => [f.key, f.enabled])) as Record<string, boolean>,
    [rows]
  );

  const isEnabled = useCallback(
    (key: FeatureFlagKey) => flags[key] === true,
    [flags]
  );

  return { flags, rows, loading, isEnabled, reload: load };
};

export default useFeatureFlags;

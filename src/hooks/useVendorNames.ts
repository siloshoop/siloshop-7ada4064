import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves store (vendor) display names for a list of vendor ids using the
 * privacy-safe `get_vendor_public_info` RPC — never reads the profiles table
 * directly, so no phone numbers or PII are exposed to the client.
 */
const nameCache = new Map<string, string>();

export const useVendorNames = (vendorIds: (string | null | undefined)[]) => {
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(nameCache),
  );
  const key = Array.from(new Set(vendorIds.filter(Boolean) as string[])).sort().join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) return;
    const missing = ids.filter((id) => !nameCache.has(id));
    if (missing.length === 0) {
      setNames(Object.fromEntries(nameCache));
      return;
    }
    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        missing.map(async (id) => {
          const { data } = await supabase.rpc("get_vendor_public_info", { vendor_id: id });
          return [id, data?.[0]?.full_name ?? ""] as const;
        }),
      );
      results.forEach(([id, name]) => nameCache.set(id, name));
      if (cancelled) return;
      setNames(
        Object.fromEntries([...nameCache.entries()].filter(([, n]) => n)),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return names;
};

export default useVendorNames;

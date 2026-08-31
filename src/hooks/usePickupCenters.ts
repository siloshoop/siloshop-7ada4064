import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PickupCenter {
  id: string;
  governorate: string;
  city: string;
  name: string;
  address: string;
  phone: string | null;
  working_hours: string | null;
  is_active: boolean;
  sort_order: number;
}

/**
 * Active pickup centers. Deliveries inside Syria are pickup-center only, so
 * checkout requires the buyer to pick one of these instead of a home address.
 */
export const usePickupCenters = (governorate?: string) => {
  const [centers, setCenters] = useState<PickupCenter[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("pickup_centers")
      .select("id, governorate, city, name, address, phone, working_hours, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (governorate) query = query.eq("governorate", governorate);

    const { data } = await query;
    setCenters((data ?? []) as PickupCenter[]);
    setLoading(false);
  }, [governorate]);

  useEffect(() => {
    void load();
  }, [load]);

  const cities = Array.from(new Set(centers.map((c) => c.city))).sort((a, b) =>
    a.localeCompare(b, "ar"),
  );

  return { centers, cities, loading, reload: load };
};

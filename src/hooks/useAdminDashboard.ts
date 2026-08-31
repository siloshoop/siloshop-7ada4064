import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardSeriesPoint {
  day: string;
  orders: number;
  revenue: number;
}
export interface DashboardUsersPoint {
  day: string;
  users: number;
}
export interface DashboardTopProduct {
  id: string;
  name: string;
  image_url: string | null;
  units: number;
  revenue: number;
}
export interface DashboardTopSeller {
  id: string;
  name: string;
  orders: number;
  revenue: number;
}
export interface DashboardLatestOrder {
  id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  customer_name: string;
}

export interface AdminDashboardData {
  days: number;
  generated_at: string;
  orders: Record<string, number>;
  revenue: Record<string, number>;
  users: Record<string, number>;
  products: Record<string, number>;
  returns: Record<string, number>;
  series: DashboardSeriesPoint[];
  users_series: DashboardUsersPoint[];
  top_products: DashboardTopProduct[];
  top_sellers: DashboardTopSeller[];
  latest_orders: DashboardLatestOrder[];
}

/**
 * Live admin dashboard data. Reads a single admin-only RPC and refreshes it
 * when orders / products change, debounced so a burst of realtime
 * events results in one refetch.
 */
export const useAdminDashboard = (days = 30) => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      const { data: res, error: rpcError } = await supabase.rpc("admin_dashboard_overview", {
        _days: days,
      });
      if (!mounted.current) return;
      if (rpcError) {
        setError(rpcError.message);
      } else {
        setError(null);
        setData(res as unknown as AdminDashboardData);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [days],
  );

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void load(true), 1500);
    };

    const channel = supabase
      .channel("admin-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { data, loading, refreshing, error, reload: () => load(true) };
};

export default useAdminDashboard;

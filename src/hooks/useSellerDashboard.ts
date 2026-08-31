import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SellerSeriesPoint {
  date: string;
  revenue: number;
  orders: number;
  views: number;
}
export interface SellerTopProduct {
  id: string;
  name: string;
  image_url: string | null;
  units: number;
  revenue: number;
}
export interface SellerLatestOrder {
  id: string;
  created_at: string;
  status: string | null;
  total_amount: number;
  city: string | null;
}
export interface SellerLatestReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  product_name: string;
}
export interface SellerLatestMessage {
  id: string;
  conversation_id: string;
  content: string | null;
  created_at: string;
  is_read: boolean;
}

export interface SellerWallet {
  settled_revenue: number;
  pending_revenue: number;
  refunded_revenue: number;
  paid_out: number;
  locked_in_requests: number;
  withdrawable: number;
}

export interface SellerDashboardData {
  days: number;
  sales: Record<string, number>;
  orders: Record<string, number>;
  products: Record<string, number>;
  engagement: Record<string, number>;
  wallet: SellerWallet;
  series: SellerSeriesPoint[];
  top_products: SellerTopProduct[];
  latest_orders: SellerLatestOrder[];
  latest_reviews: SellerLatestReview[];
  latest_messages: SellerLatestMessage[];
}

/**
 * Live seller dashboard data. One server-side RPC scoped to the signed-in
 * seller, refreshed (debounced) on realtime changes to their business tables.
 */
export const useSellerDashboard = (days = 30) => {
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      const { data: res, error: rpcError } = await supabase.rpc("seller_dashboard_overview", {
        _days: days,
      });
      if (!mounted.current) return;
      if (rpcError) setError(rpcError.message);
      else {
        setError(null);
        setData(res as unknown as SellerDashboardData);
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
      .channel("seller-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { data, loading, refreshing, error, reload: () => load(true) };
};

export default useSellerDashboard;

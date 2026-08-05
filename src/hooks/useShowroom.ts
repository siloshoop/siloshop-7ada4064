import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ShowroomItem {
  id: string;
  item_type: string;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  rating: number | null;
  is_verified: boolean;
  badge_label: string | null;
  vendor_id: string | null;
  product_id: string | null;
  link_url: string | null;
  display_order: number;
  is_pinned: boolean;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  campaign_type: string;
  sponsor_name: string | null;
  priority: number;
}

export interface ShowroomItemLive extends ShowroomItem {
  /** Live product price loaded from `products` for featured-product stands. */
  price?: number | null;
  discount_price?: number | null;
}

export const sortShowroom = (items: ShowroomItem[]) =>
  [...items].sort(
    (a, b) =>
      Number(b.is_pinned) - Number(a.is_pinned) ||
      b.priority - a.priority ||
      a.display_order - b.display_order
  );

/** Live (published) showroom items for the homepage. */
export const useShowroom = () => {
  const [items, setItems] = useState<ShowroomItemLive[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("showroom_items")
        .select("id,item_type,title,subtitle,cover_image_url,logo_url,rating,is_verified,badge_label,vendor_id,product_id,link_url,display_order,is_pinned,is_active,start_date,end_date,campaign_type,sponsor_name,priority")
        .eq("is_active", true)
        .order("is_pinned", { ascending: false })
        .order("display_order", { ascending: true });
      if (!active) return;
      const now = Date.now();
      const live = (data || []).filter(
        (i) =>
          (!i.start_date || new Date(i.start_date).getTime() <= now) &&
          (!i.end_date || new Date(i.end_date).getTime() >= now)
      );
      const sorted = sortShowroom(live as ShowroomItem[]) as ShowroomItemLive[];
      const productIds = sorted
        .filter((i) => i.item_type === "product" && i.product_id)
        .map((i) => i.product_id as string);

      if (productIds.length > 0) {
        const { data: prices } = await supabase
          .from("products")
          .select("id, price, discount_price")
          .in("id", productIds);
        if (!active) return;
        const byId = new Map((prices || []).map((p) => [p.id, p]));
        sorted.forEach((item) => {
          const p = item.product_id ? byId.get(item.product_id) : undefined;
          if (p) {
            item.price = p.price;
            item.discount_price = p.discount_price;
          }
        });
      }

      setItems(sorted);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { items, loading };
};

export type ShowroomStatus = "active" | "scheduled" | "expired" | "disabled";

export const getShowroomStatus = (item: ShowroomItem): ShowroomStatus => {
  if (!item.is_active) return "disabled";
  const now = Date.now();
  if (item.start_date && new Date(item.start_date).getTime() > now) return "scheduled";
  if (item.end_date && new Date(item.end_date).getTime() < now) return "expired";
  return "active";
};

/** All items, for the Super Admin management page. */
export const useShowroomAdmin = () => {
  const [items, setItems] = useState<ShowroomItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("showroom_items")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("display_order", { ascending: true });
    setItems(sortShowroom((data || []) as ShowroomItem[]));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, setItems, loading, refresh };
};

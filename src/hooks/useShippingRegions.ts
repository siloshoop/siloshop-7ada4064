import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { loadShippingRegions } from "@/lib/shippingRegions";

export const useShippingRegions = (vendorIds: (string | undefined | null)[]) => {
  const ids = [...new Set(vendorIds.filter((id): id is string => !!id))].sort();
  const query = useQuery({
    queryKey: ["vendor-shipping-regions", ids],
    queryFn: () => loadShippingRegions(ids),
    enabled: ids.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });
  const key = ids.join(",");
  const { refetch } = query;
  useEffect(() => {
    const refresh = () => { if (key) void refetch(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [key, refetch]);
  return query;
};
import { useQuery } from "@tanstack/react-query";
import { loadShippingRegions } from "@/lib/shippingRegions";

export const useShippingRegions = (vendorIds: (string | undefined | null)[]) => {
  const ids = [...new Set(vendorIds.filter((id): id is string => !!id))].sort();
  return useQuery({
    queryKey: ["vendor-shipping-regions", ids],
    queryFn: () => loadShippingRegions(ids),
    enabled: ids.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};
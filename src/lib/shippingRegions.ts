import { SYRIAN_GOVERNORATES } from "@/lib/syrianGovernorates";
import { supabase } from "@/integrations/supabase/client";

export interface ShippingRegions {
  shipping_all_provinces: boolean;
  shipping_provinces: string[];
}
export interface VendorShippingRegions extends ShippingRegions { vendor_id: string }
export const validProvince = (value: string) => SYRIAN_GOVERNORATES.some((p) => p === value);
export const shipsToProvince = (regions: ShippingRegions, province: string): boolean =>
  validProvince(province) && (regions.shipping_all_provinces || regions.shipping_provinces.includes(province));
export const shippingRegionsLabel = (regions?: ShippingRegions | null): string =>
  !regions ? "تعذّر تحميل محافظات الشحن" : regions.shipping_all_provinces
    ? "جميع المحافظات السورية" : regions.shipping_provinces.join("، ") || "لا توجد محافظات شحن محددة";
export const loadShippingRegions = async (vendorIds: string[]): Promise<VendorShippingRegions[]> => {
  if (!vendorIds.length) return [];
  const { data, error } = await supabase.rpc("get_vendor_shipping_regions", { _vendor_ids: [...new Set(vendorIds)] });
  if (error) throw error;
  return data ?? [];
};
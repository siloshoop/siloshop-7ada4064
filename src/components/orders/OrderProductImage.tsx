import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTION_ORIGIN } from "@/lib/shareUrl";

export const resolveOrderImage = (value?: string | null): string | null => {
  const source = value?.trim();
  if (!source || source === "/placeholder.svg") return null;
  if (/^(https?:|data:image\/|blob:)/i.test(source)) return source;
  if (source.startsWith("//")) return `https:${source}`;
  if (source.startsWith("/")) return Capacitor.isNativePlatform() ? `${PRODUCTION_ORIGIN}${source}` : source;
  return supabase.storage.from("product-images").getPublicUrl(source.replace(/^product-images\//, "")).data.publicUrl;
};

interface Props {
  image?: string | null;
  fallbackImage?: string | null;
  orderItemId?: string;
  productId?: string;
  alt: string;
  className?: string;
}

/** Preserve the order snapshot first; only read a current product image if it fails. */
const OrderProductImage = ({ image, fallbackImage, orderItemId, productId, alt, className }: Props) => {
  const [candidates, setCandidates] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setCandidates([...new Set([resolveOrderImage(image), resolveOrderImage(fallbackImage)].filter((url): url is string => !!url))]);
    setIndex(0);
    setFailed(false);
  }, [image, fallbackImage, orderItemId, productId]);

  useEffect(() => {
    if (!failed && (image || fallbackImage)) return;
    let active = true;
    const load = async () => {
      let id = productId;
      if (!id && orderItemId) {
        const { data } = await supabase.from("order_items").select("product_id").eq("id", orderItemId).maybeSingle();
        id = data?.product_id;
      }
      if (!id) return;
      const { data } = await supabase.from("products").select("image_url, images").eq("id", id).maybeSingle();
      const urls = [data?.image_url, ...(data?.images || [])].map(resolveOrderImage).filter((url): url is string => !!url);
      if (active) setCandidates((previous) => [...new Set([...previous, ...urls])]);
    };
    void load().catch(() => { /* Missing/archived products retain the placeholder. */ });
    return () => { active = false; };
  }, [failed, image, fallbackImage, productId, orderItemId]);

  return <img src={candidates[index] || "/placeholder.svg"} alt={alt} loading="lazy" decoding="async"
    className={className} onError={() => {
      if (!candidates[index]) return;
      setIndex((current) => current + 1);
      setFailed(true);
    }} />;
};

export default OrderProductImage;
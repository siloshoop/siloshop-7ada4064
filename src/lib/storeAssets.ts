import { supabase } from "@/integrations/supabase/client";

export const STORE_ASSETS_BUCKET = "store-assets";

const cache = new Map<string, { url: string; expires: number }>();

/**
 * Store logo/cover values may be stored either as a full URL (legacy) or as a
 * `store-assets` storage path. Private bucket paths need a signed URL to render.
 */
export const resolveStoreAssetUrl = async (pathOrUrl?: string | null): Promise<string | null> => {
  if (!pathOrUrl) return null;
  if (/^(https?:|data:|blob:)/.test(pathOrUrl)) return pathOrUrl;

  const cached = cache.get(pathOrUrl);
  if (cached && cached.expires > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(STORE_ASSETS_BUCKET)
    .createSignedUrl(pathOrUrl, 3600);
  if (error || !data?.signedUrl) return null;

  cache.set(pathOrUrl, { url: data.signedUrl, expires: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
};

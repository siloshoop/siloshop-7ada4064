import { supabase } from "@/integrations/supabase/client";
import { isInternalAdPath } from "@/lib/adSchedule";

/** native_ads placement reserved for the owner-managed homepage carousel. */
export const CAROUSEL_PLACEMENT = "home_carousel";
export const CAROUSEL_CURRENCIES = ["SYP", "USD"] as const;
export type CarouselCurrency = (typeof CAROUSEL_CURRENCIES)[number];
export const MIN_SLIDE_SECONDS = 2;
export const MAX_SLIDE_SECONDS = 20;

export interface CarouselSettings { autoplay: boolean; slide_duration_ms: number }
export const DEFAULT_CAROUSEL_SETTINGS: CarouselSettings = { autoplay: true, slide_duration_ms: 4500 };

/** One slide as rendered on the homepage (ads and the best-seller fallback share it). */
export interface CarouselSlideData {
  key: string;
  adId: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  href: string | null;
}

export interface CarouselAdRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_url: string | null;
  price: number | null;
  currency: string | null;
  priority: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

export const CAROUSEL_AD_COLUMNS = "id,title,description,image_url,cta_url,price,currency,priority,is_active,start_date,end_date";

export const adToSlide = (ad: Pick<CarouselAdRow, "id" | "title" | "description" | "image_url" | "cta_url" | "price" | "currency">): CarouselSlideData => ({
  key: ad.id, adId: ad.id, title: ad.title, description: ad.description, imageUrl: ad.image_url,
  price: ad.price, currency: ad.currency, href: ad.cta_url,
});

/** Live slides only: active and inside the schedule (the database also enforces this for shoppers). */
export const isLiveCarouselAd = (ad: Pick<CarouselAdRow, "is_active" | "start_date" | "end_date">, now = Date.now()) =>
  ad.is_active && (!ad.start_date || Date.parse(ad.start_date) <= now) && (!ad.end_date || Date.parse(ad.end_date) > now);

/** Display order: lower number first, then newest. */
export const sortCarouselAds = <T extends { priority: number; start_date?: string | null; id: string }>(ads: T[]) =>
  [...ads].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

export async function fetchLiveCarouselAds(): Promise<CarouselAdRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("native_ads").select(CAROUSEL_AD_COLUMNS)
    .eq("placement", CAROUSEL_PLACEMENT).eq("is_active", true)
    .or(`start_date.is.null,start_date.lte.${now}`).or(`end_date.is.null,end_date.gt.${now}`)
    .order("priority", { ascending: true }).limit(20);
  if (error) throw error;
  return ((data ?? []) as CarouselAdRow[]).filter((ad) => isLiveCarouselAd(ad));
}

export const normalizeCarouselSettings = (row: Partial<CarouselSettings> | null | undefined): CarouselSettings => ({
  autoplay: row?.autoplay ?? DEFAULT_CAROUSEL_SETTINGS.autoplay,
  slide_duration_ms: Math.min(MAX_SLIDE_SECONDS * 1000, Math.max(MIN_SLIDE_SECONDS * 1000, row?.slide_duration_ms ?? DEFAULT_CAROUSEL_SETTINGS.slide_duration_ms)),
});

export async function fetchCarouselSettings(): Promise<CarouselSettings> {
  const { data, error } = await supabase.from("home_carousel_settings").select("autoplay,slide_duration_ms").eq("id", 1).maybeSingle();
  if (error) throw error;
  return normalizeCarouselSettings(data);
}

export const carouselSlot = (adId: string) => `home-carousel-${adId}`;

const VISITOR_KEY = "siloshop:ad-visitor";
const randomId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/**
 * Random first-party id for this browser, used only to count unique ad visitors.
 * Not derived from the device (no fingerprinting); signed-in accounts are attached by the server.
 */
export function adVisitorId(storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage): string | null {
  if (!storage) return null;
  try {
    const saved = storage.getItem(VISITOR_KEY);
    if (saved && saved.length <= 100) return saved;
    const fresh = randomId();
    storage.setItem(VISITOR_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

/** Impressions count once per ad per browser session; every click counts. */
export function trackCarouselEvent(
  adId: string,
  event: "impression" | "click",
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof sessionStorage === "undefined" ? null : sessionStorage,
  visitorStorage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage === "undefined" ? null : localStorage,
) {
  const slot = carouselSlot(adId);
  if (event === "impression" && storage) {
    const key = `siloshop:seen:${slot}`;
    try { if (storage.getItem(key)) return false; storage.setItem(key, "1"); } catch { /* storage blocked: still record */ }
  }
  void supabase.from("ad_analytics").insert({
    ad_slot: slot, event_type: event, session_id: adVisitorId(visitorStorage),
    page_url: typeof location === "undefined" ? null : location.pathname.slice(0, 500),
  })
    .then(({ error }) => { if (error) console.warn("Ad tracking failed:", error.message); });
  return true;
}

export interface CarouselAdForm {
  title: string;
  description: string;
  image_url: string;
  cta_url: string;
  price: string;
  currency: CarouselCurrency | "";
  priority: number;
  is_active: boolean;
  start_date: string;
  end_date: string;
}

/** Returns an Arabic error message, or null when the ad can be saved. */
export function validateCarouselAd(form: CarouselAdForm): string | null {
  if (!form.title.trim()) return "عنوان الإعلان مطلوب.";
  if (form.title.trim().length > 120) return "العنوان طويل جدًا (120 حرفًا كحد أقصى).";
  if (!form.image_url.trim()) return "ارفع صورة للإعلان.";
  if (!isInternalAdPath(form.cta_url.trim())) return "رابط الوجهة يجب أن يكون مسارًا داخليًا يبدأ بـ / مثل /product/...";
  const price = form.price.trim();
  if (price) {
    const n = Number(price);
    if (!Number.isFinite(n) || n < 0) return "أدخل سعرًا صحيحًا.";
    if (!form.currency) return "اختر عملة السعر.";
  }
  if (!Number.isInteger(form.priority) || form.priority < 0) return "ترتيب العرض يجب أن يكون رقمًا صحيحًا موجبًا.";
  return null;
}

export const priceFields = (form: Pick<CarouselAdForm, "price" | "currency">) =>
  form.price.trim() ? { price: Number(form.price.trim()), currency: form.currency || null } : { price: null, currency: null };

export function validateSlideSeconds(value: number): string | null {
  if (!Number.isFinite(value) || value < MIN_SLIDE_SECONDS || value > MAX_SLIDE_SECONDS) return `مدة الشريحة بين ${MIN_SLIDE_SECONDS} و${MAX_SLIDE_SECONDS} ثانية.`;
  return null;
}

export const clickThroughRate = (impressions: number, clicks: number) =>
  impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : "—";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import CarouselSlide from "@/components/home/CarouselSlide";
import {
  DEFAULT_CAROUSEL_SETTINGS, adToSlide, fetchCarouselSettings, fetchLiveCarouselAds, trackCarouselEvent,
  type CarouselSettings, type CarouselSlideData,
} from "@/lib/homeCarousel";

interface Item { id: string; name: string; price: number; currency: string | null; image_url: string | null }

/**
 * Compact auto-sliding homepage carousel. Shows the owner-managed live ads; when none are
 * scheduled it keeps the previous strip of 6 best-selling active products.
 */
export default function AnimatedProductCarousel() {
  const [items, setItems] = useState<CarouselSlideData[]>([]);
  const [settings, setSettings] = useState<CarouselSettings>(DEFAULT_CAROUSEL_SETTINGS);
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [tick, setTick] = useState(0); // restarts the timer after manual navigation
  const [visible, setVisible] = useState(false);
  const hovering = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [ads, loadedSettings] = await Promise.all([
        fetchLiveCarouselAds().catch(() => []),
        fetchCarouselSettings().catch(() => DEFAULT_CAROUSEL_SETTINGS),
      ]);
      if (!alive) return;
      setSettings(loadedSettings);
      setUserPaused(!loadedSettings.autoplay);
      if (ads.length) { setItems(ads.map(adToSlide)); setIndex(0); return; }
      const { data } = await supabase.from("products").select("id,name,price,currency,image_url")
        .eq("is_active", true).order("sold_count", { ascending: false }).limit(6);
      if (!alive) return;
      setItems(((data ?? []) as Item[]).map((p) => ({
        key: p.id, adId: null, title: p.name, description: null, imageUrl: p.image_url,
        price: p.price, currency: p.currency, href: `/product/${p.id}`,
      })));
      setIndex(0);
    };
    void load();
    const refresh = () => void load();
    window.addEventListener("activation-changed", refresh);
    return () => { alive = false; window.removeEventListener("activation-changed", refresh); };
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length > 0]);

  const current = items[index];
  useEffect(() => {
    if (visible && current?.adId) trackCarouselEvent(current.adId, "impression");
  }, [visible, current?.adId]);

  useEffect(() => {
    if (items.length < 2 || userPaused) return;
    const t = window.setInterval(() => { if (!hovering.current) setIndex((i) => (i + 1) % items.length); }, settings.slide_duration_ms);
    return () => window.clearInterval(t);
  }, [items.length, userPaused, tick, settings.slide_duration_ms]);

  if (!items.length) return null;
  const n = items.length;
  const goTo = (i: number) => { setIndex(((i % n) + n) % n); setTick((t) => t + 1); };
  const ctrl = "flex h-7 w-7 items-center justify-center rounded-full border bg-background/95 text-foreground shadow-sm hover:bg-primary hover:text-primary-foreground";

  return (
    <section ref={sectionRef} aria-label="منتجات مميزة" aria-roledescription="carousel" className="container px-4 py-3" dir="rtl"
      onPointerEnter={() => (hovering.current = true)} onPointerLeave={() => (hovering.current = false)}
      onFocusCapture={() => (hovering.current = true)} onBlurCapture={() => (hovering.current = false)}>
      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-lg">
        <div className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(${index * 100}%)` }} aria-live={userPaused ? "polite" : "off"}>
          {items.map((slide, i) => (
            <CarouselSlide key={slide.key} slide={slide} active={i === index}
              onOpen={slide.adId ? () => trackCarouselEvent(slide.adId as string, "click") : undefined} />
          ))}
        </div>
        {n > 1 && (
          <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <button type="button" aria-label="السابق" onClick={() => goTo(index - 1)} className={ctrl}><ChevronRight className="h-4 w-4" /></button>
            <div className="flex items-center gap-1">
              {items.map((slide, i) => (
                <button key={slide.key} type="button" aria-label={`الشريحة ${i + 1} من ${n}`} aria-current={i === index}
                  onClick={() => goTo(i)} className="flex h-6 items-center px-0.5">
                  <span className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-primary" : "w-1.5 bg-scrim-foreground/70")} />
                </button>
              ))}
            </div>
            <button type="button" aria-label="التالي" onClick={() => goTo(index + 1)} className={ctrl}><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label={userPaused ? "تشغيل" : "إيقاف مؤقت"} aria-pressed={userPaused}
              onClick={() => setUserPaused((v) => !v)} className={ctrl}>
              {userPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

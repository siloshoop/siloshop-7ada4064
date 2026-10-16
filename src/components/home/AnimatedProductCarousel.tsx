import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface Item { id: string; name: string; price: number; currency: string | null; image_url: string | null }

/** Compact auto-sliding strip of 6 best-selling active products, with manual controls. */
export default function AnimatedProductCarousel() {
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [tick, setTick] = useState(0); // restarts the timer after manual navigation
  const hovering = useRef(false);

  useEffect(() => {
    void supabase.from("products").select("id,name,price,currency,image_url")
      .eq("is_active", true).order("sold_count", { ascending: false }).limit(6)
      .then(({ data }) => setItems((data ?? []) as Item[]));
  }, []);

  useEffect(() => {
    if (items.length < 2 || userPaused) return;
    const t = window.setInterval(() => { if (!hovering.current) setIndex((i) => (i + 1) % items.length); }, 4500);
    return () => window.clearInterval(t);
  }, [items.length, userPaused, tick]);

  if (!items.length) return null;
  const n = items.length;
  const goTo = (i: number) => { setIndex(((i % n) + n) % n); setTick((t) => t + 1); };
  const ctrl = "flex h-7 w-7 items-center justify-center rounded-full border bg-background/95 text-foreground shadow-sm hover:bg-primary hover:text-primary-foreground";

  return (
    <section aria-label="منتجات مميزة" aria-roledescription="carousel" className="container px-4 py-3" dir="rtl"
      onPointerEnter={() => (hovering.current = true)} onPointerLeave={() => (hovering.current = false)}
      onFocusCapture={() => (hovering.current = true)} onBlurCapture={() => (hovering.current = false)}>
      <div className="relative overflow-hidden rounded-xl border bg-card">
        <div className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(${index * 100}%)` }} aria-live={userPaused ? "polite" : "off"}>
          {items.map((p, i) => (
            <Link key={p.id} to={`/product/${p.id}`} tabIndex={i === index ? 0 : -1} aria-hidden={i !== index}
              className="flex h-24 w-full shrink-0 items-center gap-3 p-2 pb-7 sm:h-28">
              <img src={p.image_url || "/placeholder.svg"} alt={p.name} loading="lazy" decoding="async"
                className="h-full aspect-square shrink-0 rounded-lg bg-muted object-cover" />
              <div className="min-w-0 flex-1 text-right">
                <span className="text-[10px] font-semibold text-primary">إعلان</span>
                <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                <p className="text-sm font-bold text-primary">{formatPrice(p.price, p.currency)}</p>
              </div>
            </Link>
          ))}
        </div>
        {n > 1 && (
          <div className="absolute bottom-1 left-2 flex items-center gap-1.5">
            <button type="button" aria-label="السابق" onClick={() => goTo(index - 1)} className={ctrl}><ChevronRight className="h-4 w-4" /></button>
            <div className="flex items-center gap-1">
              {items.map((p, i) => (
                <button key={p.id} type="button" aria-label={`الشريحة ${i + 1} من ${n}`} aria-current={i === index}
                  onClick={() => goTo(i)} className="flex h-6 items-center px-0.5">
                  <span className={cn("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-primary" : "w-1.5 bg-border")} />
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

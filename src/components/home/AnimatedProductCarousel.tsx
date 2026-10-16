import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface Item { id: string; name: string; price: number; currency: string | null; image_url: string | null }

/** Compact auto-sliding strip of 6 best-selling active products. */
export default function AnimatedProductCarousel() {
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    void supabase.from("products").select("id,name,price,currency,image_url")
      .eq("is_active", true).order("sold_count", { ascending: false }).limit(6)
      .then(({ data }) => setItems((data ?? []) as Item[]));
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const t = window.setInterval(() => { if (!paused.current) setIndex((i) => (i + 1) % items.length); }, 3500);
    return () => window.clearInterval(t);
  }, [items.length]);

  if (!items.length) return null;

  return (
    <section aria-label="منتجات مميزة" className="container px-4 py-3" dir="rtl"
      onPointerEnter={() => (paused.current = true)} onPointerLeave={() => (paused.current = false)}>
      <div className="relative overflow-hidden rounded-xl border bg-card">
        <div className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(${index * 100}%)` }}>
          {items.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} className="flex h-24 w-full shrink-0 items-center gap-3 p-2 sm:h-28">
              <img src={p.image_url || "/placeholder.svg"} alt={p.name} loading="lazy" decoding="async"
                className="h-full aspect-square shrink-0 rounded-lg bg-muted object-cover" />
              <div className="min-w-0 flex-1 text-right">
                <span className="text-[10px] font-semibold text-primary">إعلان</span>
                <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                <p className="text-sm font-bold text-primary">{formatPrice(p.price, p.currency)}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="absolute bottom-1.5 left-2 flex gap-1">
          {items.map((p, i) => (
            <button key={p.id} type="button" aria-label={`الشريحة ${i + 1}`} onClick={() => setIndex(i)}
              className={cn("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-primary" : "w-1.5 bg-border")} />
          ))}
        </div>
      </div>
    </section>
  );
}

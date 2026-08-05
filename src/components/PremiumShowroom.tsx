import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, Sparkles, Star, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useShowroom, type ShowroomItem, type ShowroomItemLive } from "@/hooks/useShowroom";
import { showroomDemoItems } from "@/data/showroomDemo";

const formatPrice = (value: number) => `${Number(value).toLocaleString("ar-SY")} ل.س`;
const targetOf = (item: ShowroomItem) => {
  if (item.link_url?.startsWith("/")) return item.link_url;
  if (item.item_type === "product" && item.product_id) return `/product/${item.product_id}`;
  if (item.item_type === "store" && item.vendor_id) return `/vendor/${item.vendor_id}/ratings`;
  return null;
};

interface StandProps { item: ShowroomItemLive; offset: number; isCenter: boolean; isDemo: boolean; priority: boolean; onSelect: () => void; }

const ShowroomStand = memo(({ item, offset, isCenter, isDemo, priority, onSelect }: StandProps) => {
  const navigate = useNavigate();
  const target = isDemo ? null : targetOf(item);
  const abs = Math.abs(offset);
  const style: React.CSSProperties = {
    transform: `translate(-50%, -50%) translateX(${offset * 58}%) translateZ(${isCenter ? 0 : -110}px) rotateY(${offset * -12}deg) scale(${isCenter ? 1 : 0.84})`,
    opacity: 1 - Math.min(abs, 2) * 0.18,
    zIndex: 20 - Math.round(abs * 5),
  };

  return (
    <article style={style} onClick={() => isCenter ? target && navigate(target) : onSelect()} className={cn("absolute left-1/2 top-1/2 w-[76%] cursor-pointer select-none overflow-hidden rounded-2xl border border-border/60 bg-card/80 sm:w-[58%] lg:w-[42%]", "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]", isCenter ? "shadow-[var(--shadow-elegant)] ring-1 ring-primary/20" : "shadow-[var(--shadow-card)]")}>
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {item.cover_image_url ? <img src={item.cover_image_url} alt={item.title} loading={priority ? "eager" : "lazy"} decoding="async" width={800} height={500} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" /> : <div className="h-full w-full bg-gradient-to-br from-primary/20 to-accent/20" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/10 to-transparent" />
        {item.badge_label && <span className="absolute start-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground shadow-md">{item.badge_label}</span>}
        {item.logo_url && <img src={item.logo_url} alt="" loading="lazy" decoding="async" width={56} height={56} className="absolute -bottom-6 end-4 h-14 w-14 rounded-2xl border-2 border-background bg-card object-cover shadow-lg" />}
      </div>
      <div className="space-y-3 p-4 md:p-5">
        <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">{item.item_type === "store" ? <Store className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}{item.item_type === "store" ? "متجر مميز" : "منتج مميز"}</span>{item.is_verified && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success"><BadgeCheck className="h-3.5 w-3.5" /> موثّق</span>}{item.rating != null && <span className="ms-auto inline-flex items-center gap-1 text-xs font-bold"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{Number(item.rating).toFixed(1)}</span>}</div>
        <h2 className="line-clamp-1 text-lg font-bold md:text-xl">{item.title}</h2>
        {item.subtitle && <p className="line-clamp-2 text-sm text-muted-foreground">{item.subtitle}</p>}
        {item.item_type === "product" && item.price != null && <div className="flex items-baseline gap-2"><span className="text-lg font-extrabold text-primary">{formatPrice(item.discount_price ?? item.price)}</span>{item.discount_price != null && item.discount_price < item.price && <span className="text-sm text-muted-foreground line-through">{formatPrice(item.price)}</span>}</div>}
        <div className="flex gap-2 pt-1"><Button size="sm" className="group gap-1.5" tabIndex={isCenter ? 0 : -1} disabled={!target} onClick={(event) => { event.stopPropagation(); if (target) navigate(target); }}>{item.item_type === "store" ? "زيارة المتجر" : "عرض المنتج"}<ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /></Button>{item.sponsor_name && <span className="self-center text-[11px] text-muted-foreground">برعاية {item.sponsor_name}</span>}</div>
      </div>
    </article>
  );
});
ShowroomStand.displayName = "ShowroomStand";

interface PremiumShowroomProps { showEmptyState?: boolean; demoItems?: ShowroomItemLive[]; demoFallback?: boolean; }
const PremiumShowroom = ({ showEmptyState = false, demoItems, demoFallback = false }: PremiumShowroomProps) => {
  const { items: liveItems, loading: liveLoading } = useShowroom();
  const usingDemo = Boolean(demoItems) || (demoFallback && !liveLoading && liveItems.length === 0);
  const items = demoItems ?? (usingDemo ? showroomDemoItems : liveItems);
  const loading = demoItems ? false : liveLoading;
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const count = items.length;
  const go = useCallback((direction: number) => setIndex((current) => Math.min(Math.max(current + direction, 0), Math.max(count - 1, 0))), [count]);
  const dragOffset = useMemo(() => -(drag / (stageRef.current?.offsetWidth ?? 1)) * 1.6, [drag]);

  if (loading) return <section aria-label="تحميل المعرض المميز" className="bg-gradient-to-br from-secondary via-background to-accent/5"><div className="container px-4 py-10 md:py-14"><div className="mx-auto h-[300px] w-full max-w-3xl animate-pulse rounded-2xl bg-muted md:h-[420px]" /></div></section>;
  if (count === 0) return showEmptyState ? <section className="container px-4 py-10 text-center"><h2 className="text-lg font-bold">لا توجد عناصر منشورة في المعرض</h2></section> : null;

  return <section aria-label="معرض العروض المميزة" className="relative overflow-hidden bg-gradient-to-br from-secondary via-background to-accent/5">
    <div className="container relative px-4 py-8 md:py-12">
      <div className="mb-6 flex items-end justify-between gap-4"><div><span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" />المعرض المميز</span><h1 className="mt-3 text-2xl font-bold leading-tight md:text-4xl">تجربة تسوّق <span className="bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent">فاخرة</span> مختارة بعناية</h1>{usingDemo && <p className="mt-2 text-xs font-medium text-muted-foreground">عرض تجريبي للتصميم فقط — لا توجد عناصر منشورة حالياً</p>}</div><div className="hidden gap-2 md:flex"><Button variant="outline" size="icon" aria-label="السابق" onClick={() => go(-1)} disabled={index === 0}><ChevronRight className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="التالي" onClick={() => go(1)} disabled={index >= count - 1}><ChevronLeft className="h-4 w-4" /></Button></div></div>
      <div ref={stageRef} tabIndex={0} role="group" aria-label="عناصر المعرض — استخدم الأسهم للتنقل" className="relative h-[380px] touch-pan-y select-none md:h-[460px]" style={{ perspective: "1200px" }} onKeyDown={(event) => { if (event.key === "ArrowRight") go(-1); if (event.key === "ArrowLeft") go(1); }} onPointerDown={(event) => { startX.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (startX.current != null) setDrag(event.clientX - startX.current); }} onPointerUp={() => { if (startX.current != null && Math.abs(drag) > (stageRef.current?.offsetWidth ?? 1) * 0.08) go(drag > 0 ? -1 : 1); startX.current = null; setDrag(0); }} onPointerCancel={() => { startX.current = null; setDrag(0); }}>
        {items.map((item, itemIndex) => Math.abs(itemIndex - index) <= 1 ? <ShowroomStand key={item.id} item={item} offset={itemIndex - index + dragOffset} isCenter={itemIndex === index} priority={itemIndex === 0} onSelect={() => setIndex(itemIndex)} isDemo={usingDemo} /> : null)}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">{items.map((item, itemIndex) => <Button key={item.id} variant="ghost" size="icon" aria-label={`الانتقال إلى ${item.title}`} onClick={() => setIndex(itemIndex)} className={cn("h-6 w-6 rounded-full p-0", itemIndex === index ? "bg-primary/15" : "bg-transparent")}><span className={cn("h-1.5 rounded-full transition-[width,background-color]", itemIndex === index ? "w-4 bg-primary" : "w-1.5 bg-border")} /></Button>)}</div>
    </div>
  </section>;
};
export default PremiumShowroom;
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Star, BadgeCheck, Store, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useShowroom, type ShowroomItem } from "@/hooks/useShowroom";
import HeroSection from "@/components/HeroSection";

const targetOf = (item: ShowroomItem) => {
  if (item.link_url && item.link_url.startsWith("/")) return item.link_url;
  if (item.item_type === "product" && item.product_id) return `/product/${item.product_id}`;
  if (item.item_type === "store" && item.vendor_id) return `/vendor/${item.vendor_id}/ratings`;
  return null;
};

const ShowroomStand = ({
  item,
  offset,
  isCenter,
  onSelect,
}: {
  item: ShowroomItem;
  offset: number;
  isCenter: boolean;
  onSelect: () => void;
}) => {
  const navigate = useNavigate();
  const target = targetOf(item);
  const abs = Math.abs(offset);
  const style: React.CSSProperties = {
    transform: `translate(-50%, -50%) translateX(${offset * 58}%) translateZ(${isCenter ? 0 : -120 - abs * 40}px) rotateY(${offset * -14}deg) scale(${isCenter ? 1 : 0.84 - (abs - 1) * 0.06})`,
    opacity: abs > 2.4 ? 0 : 1 - abs * 0.18,
    zIndex: 20 - Math.round(abs * 5),
    pointerEvents: abs > 2.4 ? "none" : "auto",
  };

  return (
    <article
      style={style}
      onClick={() => (isCenter ? target && navigate(target) : onSelect())}
      className={cn(
        "absolute top-1/2 left-1/2 w-[76%] sm:w-[58%] lg:w-[42%] cursor-pointer select-none",
        "rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl overflow-hidden",
        "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        isCenter ? "shadow-[var(--shadow-elegant)] ring-1 ring-primary/20" : "shadow-[var(--shadow-card)]"
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {item.cover_image_url ? (
          <img
            src={item.cover_image_url}
            alt={item.title}
            loading="lazy"
            decoding="async"
            width={800}
            height={500}
            className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 to-accent/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/10 to-transparent" />
        {item.badge_label && (
          <span className="absolute top-3 start-3 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground shadow-md">
            {item.badge_label}
          </span>
        )}
        {item.logo_url && (
          <img
            src={item.logo_url}
            alt=""
            loading="lazy"
            className="absolute -bottom-6 end-4 h-14 w-14 rounded-2xl border-2 border-background object-cover shadow-lg bg-card"
          />
        )}
      </div>

      <div className="space-y-3 p-4 md:p-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            {item.item_type === "store" ? <Store className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
            {item.item_type === "store" ? "متجر مميز" : "منتج مميز"}
          </span>
          {item.is_verified && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
              <BadgeCheck className="h-3.5 w-3.5" /> موثّق
            </span>
          )}
          {item.rating != null && (
            <span className="ms-auto inline-flex items-center gap-1 text-xs font-bold text-foreground">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {Number(item.rating).toFixed(1)}
            </span>
          )}
        </div>

        <h3 className="line-clamp-1 text-lg md:text-xl font-bold">{item.title}</h3>
        {item.subtitle && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.subtitle}</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5 group"
            tabIndex={isCenter ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              if (target) navigate(target);
            }}
          >
            {item.item_type === "store" ? "زيارة المتجر" : "عرض المنتج"}
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          </Button>
          {item.sponsor_name && (
            <span className="self-center text-[11px] text-muted-foreground">
              برعاية {item.sponsor_name}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

const PremiumShowroom = () => {
  const { items, loading } = useShowroom();
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const count = items.length;
  const go = useCallback(
    (dir: number) => setIndex((i) => Math.min(Math.max(i + dir, 0), Math.max(count - 1, 0))),
    [count]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(-1);
      if (e.key === "ArrowLeft") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    setDrag(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    if (startX.current === null) return;
    const width = stageRef.current?.offsetWidth ?? 1;
    if (Math.abs(drag) > width * 0.08) go(drag > 0 ? -1 : 1);
    startX.current = null;
    setDrag(0);
  };

  const dragOffset = useMemo(() => {
    const width = stageRef.current?.offsetWidth ?? 1;
    return -(drag / width) * 1.6;
  }, [drag]);

  if (loading) {
    return (
      <section className="relative overflow-hidden bg-gradient-to-br from-secondary via-background to-accent/5">
        <div className="container px-4 py-10 md:py-14">
          <div className="mx-auto h-[300px] md:h-[420px] w-full max-w-3xl animate-pulse rounded-2xl bg-muted" />
        </div>
      </section>
    );
  }

  if (count === 0) return <HeroSection />;

  return (
    <section
      aria-label="معرض العروض المميزة"
      className="relative overflow-hidden bg-gradient-to-br from-secondary via-background to-accent/5"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-10 right-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl animate-float" />
        <div className="absolute bottom-0 left-10 h-96 w-96 rounded-full bg-accent/10 blur-3xl animate-float-gentle" style={{ animationDelay: "1.5s" }} />
      </div>

      <div className="container relative z-10 px-4 py-8 md:py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              المعرض المميز
            </span>
            <h1 className="mt-3 text-2xl md:text-4xl font-bold leading-tight">
              تجربة تسوّق
              <span className="bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent"> فاخرة </span>
              مختارة بعناية
            </h1>
          </div>
          <div className="hidden gap-2 md:flex">
            <Button variant="outline" size="icon" aria-label="السابق" onClick={() => go(-1)} disabled={index === 0}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" aria-label="التالي" onClick={() => go(1)} disabled={index >= count - 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative h-[380px] md:h-[460px] touch-pan-y select-none"
          style={{ perspective: "1400px", perspectiveOrigin: "50% 50%" }}
        >
          {items.map((item, i) => (
            <ShowroomStand
              key={item.id}
              item={item}
              offset={i - index + dragOffset}
              isCenter={i === index}
              onSelect={() => setIndex(i)}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          {items.map((item, i) => (
            <button
              key={item.id}
              aria-label={`الانتقال إلى ${item.title}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-8 bg-primary" : "w-2 bg-border hover:bg-primary/40"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default PremiumShowroom;

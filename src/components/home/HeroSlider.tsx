import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useShowroom, type ShowroomItem } from "@/hooks/useShowroom";

interface Slide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  image?: string | null;
  gradient: string;
}

const GRADIENTS = [
  "from-[hsl(263_70%_28%)] via-[hsl(280_65%_38%)] to-[hsl(340_82%_45%)]",
  "from-[hsl(215_75%_22%)] via-[hsl(240_60%_35%)] to-[hsl(263_70%_50%)]",
  "from-[hsl(340_70%_30%)] via-[hsl(320_60%_38%)] to-[hsl(28_85%_52%)]",
];

const FALLBACK_SLIDES: Slide[] = [
  {
    id: "local",
    eyebrow: "🇸🇾 السوق المحلي",
    title: "تسوّق من بائعين محليين موثوقين",
    subtitle: "دفع عند الاستلام في كل المحافظات، وضمان إرجاع خلال 14 يوماً.",
    cta: "ابدأ التسوّق",
    href: "/categories",
    gradient: GRADIENTS[0],
  },
  {
    id: "deals",
    eyebrow: "⚡ عروض سريعة",
    title: "خصومات تنتهي قريباً",
    subtitle: "تخفيضات يومية على مئات المنتجات من متاجرنا المميزة.",
    cta: "شاهد العروض",
    href: "/#daily-deals",
    gradient: GRADIENTS[1],
  },
  {
    id: "sell",
    eyebrow: "🏪 كن بائعاً",
    title: "افتح متجرك على سيلو شوب",
    subtitle: "سجّل متجرك، أضف منتجاتك، وابدأ البيع بعد موافقة الإدارة.",
    cta: "افتح متجرك",
    href: "/seller-application",
    gradient: GRADIENTS[2],
  },
];

const targetOf = (item: ShowroomItem) => {
  if (item.link_url?.startsWith("/")) return item.link_url;
  if (item.item_type === "product" && item.product_id) return `/product/${item.product_id}`;
  if (item.item_type === "store" && item.vendor_id) return `/vendor/${item.vendor_id}/ratings`;
  return null;
};

const TRUST = [
  { icon: ShieldCheck, label: "بائعون معتمدون" },
  { icon: Truck, label: "دفع عند الاستلام" },
  { icon: Sparkles, label: "إرجاع خلال 14 يوماً" },
];

const HeroSlider = () => {
  const navigate = useNavigate();
  const { items } = useShowroom();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  const slides = useMemo<Slide[]>(() => {
    const live = items
      .map((item, i): Slide | null => {
        const href = targetOf(item);
        if (!href) return null;
        return {
          id: item.id,
          eyebrow: item.badge_label || (item.item_type === "store" ? "متجر مميز" : "منتج مميز"),
          title: item.title,
          subtitle: item.subtitle || "اكتشف اختياراتنا المميزة على سيلو شوب.",
          cta: item.item_type === "store" ? "زيارة المتجر" : "عرض المنتج",
          href,
          image: item.cover_image_url,
          gradient: GRADIENTS[i % GRADIENTS.length],
        };
      })
      .filter((slide): slide is Slide => slide !== null);

    return live.length > 0 ? live.slice(0, 6) : FALLBACK_SLIDES;
  }, [items]);

  const count = slides.length;

  const go = useCallback(
    (direction: number) => setIndex((current) => (current + direction + count) % count),
    [count],
  );

  useEffect(() => {
    setIndex(0);
  }, [count]);

  useEffect(() => {
    if (paused || count < 2) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    timer.current = window.setInterval(() => setIndex((c) => (c + 1) % count), 6000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [paused, count]);

  const active = slides[index] ?? slides[0];

  return (
    <section
      aria-label="عروض مميزة"
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative h-[340px] w-full overflow-hidden sm:h-[400px] lg:h-[460px]">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            aria-hidden={i !== index}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              i === index ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br", slide.gradient)} />
            {slide.image && (
              <img
                src={slide.image}
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-luminosity"
              />
            )}
            <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_85%_10%,transparent,hsl(0_0%_0%/0.45))]" />

            <div className="container relative flex h-full items-center px-4">
              <div
                className={cn(
                  "max-w-xl space-y-4 text-primary-foreground transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                  i === index ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                )}
              >
                <span className="inline-flex items-center rounded-full border border-white/25 bg-white/15 px-3.5 py-1.5 text-xs font-bold backdrop-blur-md">
                  {slide.eyebrow}
                </span>
                <h1 className="text-2xl font-extrabold leading-tight tracking-tight drop-shadow-sm sm:text-3xl lg:text-[2.6rem]">
                  {slide.title}
                </h1>
                <p className="max-w-lg text-sm text-primary-foreground/85 sm:text-base">{slide.subtitle}</p>
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <Button
                    size="lg"
                    onClick={() =>
                      slide.href.startsWith("/#")
                        ? document
                            .querySelector(slide.href.slice(2))
                            ?.scrollIntoView({ behavior: "smooth", block: "start" })
                        : navigate(slide.href)
                    }
                    className="group gap-1.5 rounded-full bg-white px-6 font-bold text-[hsl(263_70%_30%)] shadow-lg hover:bg-white/90"
                  >
                    {slide.cta}
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
                  </Button>
                  <Link
                    to="/categories"
                    className="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-primary-foreground backdrop-blur-md transition-colors hover:bg-white/20"
                  >
                    تصفّح الفئات
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="التالي"
              onClick={() => go(1)}
              className="absolute end-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/25 bg-white/15 p-2.5 text-primary-foreground backdrop-blur-md transition-colors hover:bg-white/30 sm:block"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="السابق"
              onClick={() => go(-1)}
              className="absolute start-3 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/25 bg-white/15 p-2.5 text-primary-foreground backdrop-blur-md transition-colors hover:bg-white/30 sm:block"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="absolute bottom-4 start-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/25 px-3 py-2 backdrop-blur-md">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`الشريحة ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none",
                    i === index ? "w-7 bg-white" : "w-2.5 bg-white/45 hover:bg-white/70",
                  )}
                />
              ))}
              <button
                type="button"
                aria-label={paused ? "تشغيل" : "إيقاف"}
                onClick={() => setPaused((p) => !p)}
                className="ms-1 text-primary-foreground/80 transition-colors hover:text-primary-foreground"
              >
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="border-b border-border/60 bg-card/60 backdrop-blur-sm">
        <div className="container grid grid-cols-3 gap-2 px-4 py-3">
          {TRUST.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-2 text-center">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-[11px] font-semibold text-muted-foreground sm:text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSlider;

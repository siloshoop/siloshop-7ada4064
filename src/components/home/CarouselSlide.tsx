import { Link } from "react-router-dom";
import { formatPrice } from "@/lib/currency";
import type { CarouselSlideData } from "@/lib/homeCarousel";

const slideClass = "group relative block h-[72px] w-full shrink-0 overflow-hidden bg-muted";

/** One homepage carousel slide; shared by the homepage and the admin preview so both look identical. */
export default function CarouselSlide({ slide, active = true, onOpen, preview = false }: {
  slide: CarouselSlideData; active?: boolean; onOpen?: () => void; preview?: boolean;
}) {
  const src = slide.imageUrl || "/placeholder.svg";
  const body = (
    <>
      {/* Blurred fill so any picture shape covers the whole banner */}
      <img src={src} alt="" aria-hidden loading="lazy" decoding="async"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl" />
      {/* The full picture, never cropped */}
      <img src={src} alt={slide.title} loading="lazy" decoding="async"
        className="absolute inset-0 h-full w-full object-contain drop-shadow-lg transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]" />
      <div className="absolute inset-y-0 right-0 w-3/5 bg-gradient-to-l from-scrim/85 via-scrim/40 to-transparent" />
      <div className="absolute inset-y-0 right-0 flex max-w-[55%] flex-col items-start justify-center gap-0.5 px-3 text-right text-scrim-foreground">
        <div className="flex min-w-0 max-w-full items-center gap-1.5">
          <span className="shrink-0 rounded-full bg-primary px-2 py-px text-[9px] font-bold text-primary-foreground shadow">إعلان</span>
          <p className="line-clamp-1 text-sm font-bold drop-shadow">{slide.title}</p>
        </div>
        {slide.price != null && (
          <span className="inline-block rounded-md bg-accent px-1.5 py-px text-xs font-bold text-accent-foreground shadow">
            {formatPrice(slide.price, slide.currency)}
          </span>
        )}
      </div>
    </>
  );
  if (slide.href && !preview) {
    return (
      <Link to={slide.href} tabIndex={active ? 0 : -1} aria-hidden={!active} onClick={onOpen} className={slideClass}>
        {body}
      </Link>
    );
  }
  return <div aria-hidden={!active} className={slideClass}>{body}</div>;
}

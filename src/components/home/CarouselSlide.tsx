import { Link } from "react-router-dom";
import { formatPrice } from "@/lib/currency";
import type { CarouselSlideData } from "@/lib/homeCarousel";

// Reserve side room for the slider arrows and bottom room for the slide dots.
const slideClass =
  "group relative flex h-32 w-full shrink-0 items-center justify-center gap-3 overflow-hidden bg-gradient-ad px-10 pb-6 pt-3 text-primary-foreground sm:h-40 sm:gap-10 sm:px-14 sm:pb-7 sm:pt-4";

/** One homepage carousel slide; shared by the homepage and the admin preview so both look identical. */
export default function CarouselSlide({ slide, active = true, onOpen, preview = false }: {
  slide: CarouselSlideData; active?: boolean; onOpen?: () => void; preview?: boolean;
}) {
  const src = slide.imageUrl || "/placeholder.svg";
  const body = (
    <>
      {/* Soft decorative glows */}
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary-foreground/15 blur-xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-12 left-1/4 h-32 w-32 rounded-full bg-highlight/40 blur-2xl" />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col sm:max-w-lg items-start gap-1 text-right sm:gap-1.5">
        <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[10px] font-bold ring-1 ring-primary-foreground/40 backdrop-blur-sm sm:text-xs">
          إعلان
        </span>
        <p className="line-clamp-2 max-w-full text-sm font-extrabold leading-snug drop-shadow-sm sm:text-xl">{slide.title}</p>
        {slide.price != null && (
          <span className="rounded-full bg-highlight px-2.5 py-0.5 text-xs font-extrabold text-highlight-foreground shadow-md sm:text-sm">
            {formatPrice(slide.price, slide.currency)}
          </span>
        )}
      </div>

      <div className="relative z-10 aspect-square h-full shrink-0 overflow-hidden rounded-xl bg-card p-1 shadow-lg ring-2 ring-primary-foreground/50">
        <img src={src} alt={slide.title} loading="lazy" decoding="async"
          className="h-full w-full rounded-lg object-contain transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105" />
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

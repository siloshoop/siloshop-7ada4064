import { Link } from "react-router-dom";
import { formatPrice } from "@/lib/currency";
import type { CarouselSlideData } from "@/lib/homeCarousel";

const slideClass = "group relative block h-48 w-full shrink-0 overflow-hidden bg-muted sm:h-60 md:h-72";

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
        className="absolute inset-0 h-full w-full object-contain drop-shadow-xl transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]" />
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-scrim/85 via-scrim/40 to-transparent" />
      <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-md">إعلان</span>
      <div className="absolute inset-x-0 bottom-0 px-4 pb-10 text-right text-scrim-foreground sm:pb-11">
        <p className="line-clamp-1 text-base font-bold drop-shadow sm:text-lg">{slide.title}</p>
        {slide.description && <p className="hidden line-clamp-1 text-xs text-scrim-foreground/80 sm:block">{slide.description}</p>}
        {slide.price != null && (
          <span className="mt-1 inline-block rounded-md bg-accent px-2 py-0.5 text-sm font-bold text-accent-foreground shadow">
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

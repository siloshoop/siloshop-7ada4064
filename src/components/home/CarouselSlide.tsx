import { Link } from "react-router-dom";
import { formatPrice } from "@/lib/currency";
import type { CarouselSlideData } from "@/lib/homeCarousel";

const slideClass = "flex h-24 w-full shrink-0 items-center gap-3 p-2 pb-7 sm:h-28";

/** One homepage carousel slide; shared by the homepage and the admin preview so both look identical. */
export default function CarouselSlide({ slide, active = true, onOpen, preview = false }: {
  slide: CarouselSlideData; active?: boolean; onOpen?: () => void; preview?: boolean;
}) {
  const body = (
    <>
      <img src={slide.imageUrl || "/placeholder.svg"} alt={slide.title} loading="lazy" decoding="async"
        className="h-full aspect-square shrink-0 rounded-lg bg-muted object-cover" />
      <div className="min-w-0 flex-1 text-right">
        <span className="text-[10px] font-semibold text-primary">إعلان</span>
        <p className="line-clamp-1 text-sm font-medium">{slide.title}</p>
        {slide.description && <p className="hidden line-clamp-1 text-xs text-muted-foreground sm:block">{slide.description}</p>}
        {slide.price != null && <p className="text-sm font-bold text-primary">{formatPrice(slide.price, slide.currency)}</p>}
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

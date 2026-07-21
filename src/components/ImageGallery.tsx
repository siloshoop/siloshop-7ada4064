import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ImageGalleryProps {
  images: string[];
  productName: string;
}

/**
 * Premium product image gallery
 *  - Vertical thumbnails on desktop, horizontal strip on mobile
 *  - Keyboard arrows + swipe navigation
 *  - Hover-zoom (desktop) with pointer tracking
 *  - Lightbox with pinch-to-zoom on touch, wheel-zoom on desktop
 *  - Lazy-loaded images, fade transitions between slides
 */
export const ImageGallery = ({ images, productName }: ImageGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [fadeKey, setFadeKey] = useState(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const total = images.length;

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? total - 1 : prev - 1));
    setFadeKey((k) => k + 1);
  }, [total]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === total - 1 ? 0 : prev + 1));
    setFadeKey((k) => k + 1);
  }, [total]);

  const goToImage = (index: number) => {
    setCurrentIndex(index);
    setFadeKey((k) => k + 1);
  };

  // Keyboard navigation (works in RTL — left key moves to next in RTL semantics for images)
  useEffect(() => {
    if (total <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isLightboxOpen && document.activeElement?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") goToNext();
      else if (e.key === "ArrowRight") goToPrevious();
      else if (e.key === "Escape" && isLightboxOpen) setIsLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, isLightboxOpen, goToNext, goToPrevious]);

  // Swipe handling (touch)
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!swipeStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeStart.current.x;
    const dy = t.clientY - swipeStart.current.y;
    swipeStart.current = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    // RTL: swipe right → previous image feels natural
    if (dx > 0) goToPrevious();
    else goToNext();
  };

  // Hover zoom for desktop
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin({ x, y });
  };

  if (total === 0) {
    return (
      <div className="w-full aspect-square bg-muted rounded-2xl flex items-center justify-center">
        <p className="text-muted-foreground text-sm">لا توجد صورة</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col-reverse md:flex-row-reverse gap-3 md:gap-4">
        {/* Main Image */}
        <div
          className="relative flex-1 aspect-square bg-muted rounded-2xl overflow-hidden group select-none touch-pan-y"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onMouseEnter={() => setIsZooming(true)}
          onMouseLeave={() => setIsZooming(false)}
          onMouseMove={onMouseMove}
        >
          <img
            key={fadeKey}
            src={images[currentIndex]}
            alt={`${productName} - ${currentIndex + 1}`}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover animate-fade-in transition-transform duration-300 ease-out will-change-transform"
            style={
              isZooming
                ? {
                    transform: "scale(1.6)",
                    transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                  }
                : undefined
            }
          />

          {/* Fullscreen button */}
          <Button
            variant="secondary"
            size="icon"
            aria-label="عرض بالحجم الكامل"
            className="absolute top-3 left-3 h-9 w-9 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur"
            onClick={() => setIsLightboxOpen(true)}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>

          {total > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                aria-label="الصورة السابقة"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur"
                onClick={goToPrevious}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="الصورة التالية"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur"
                onClick={goToNext}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              {/* Dot indicators */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    aria-label={`الصورة ${i + 1}`}
                    onClick={() => goToImage(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentIndex ? "w-6 bg-primary" : "w-1.5 bg-foreground/30"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thumbnails: vertical on desktop, horizontal on mobile */}
        {total > 1 && (
          <div className="flex md:flex-col gap-2 md:w-20 overflow-x-auto md:overflow-y-auto md:max-h-[520px] no-scrollbar">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => goToImage(index)}
                aria-label={`عرض الصورة ${index + 1}`}
                aria-current={index === currentIndex}
                className={`shrink-0 w-16 h-16 md:w-full md:h-20 rounded-lg overflow-hidden border transition-all ${
                  index === currentIndex
                    ? "border-primary ring-2 ring-primary/40"
                    : "border-border/60 opacity-70 hover:opacity-100"
                }`}
              >
                <img
                  src={image}
                  alt={`${productName} صورة ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-7xl w-[95vw] h-[92vh] p-0 overflow-hidden">
          <Lightbox
            images={images}
            productName={productName}
            index={currentIndex}
            onIndex={goToImage}
            onPrev={goToPrevious}
            onNext={goToNext}
            onClose={() => setIsLightboxOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

/** Lightbox with wheel + pinch zoom, drag-pan, swipe navigation. */
const Lightbox = ({
  images,
  productName,
  index,
  onIndex,
  onPrev,
  onNext,
  onClose,
}: {
  images: string[];
  productName: string;
  index: number;
  onIndex: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) => {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  // Reset zoom when image changes
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [index]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(4, Math.max(1, s + (e.deltaY < 0 ? 0.2 : -0.2))));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchStart.current = { dist, scale };
    } else if (e.touches.length === 1) {
      if (scale > 1) {
        dragStart.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          tx: translate.x,
          ty: translate.y,
        };
      } else {
        swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const next = Math.min(4, Math.max(1, (dist / pinchStart.current.dist) * pinchStart.current.scale));
      setScale(next);
    } else if (e.touches.length === 1 && dragStart.current) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setTranslate({ x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    pinchStart.current = null;
    dragStart.current = null;
    if (!swipeStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeStart.current.x;
    const dy = t.clientY - swipeStart.current.y;
    swipeStart.current = null;
    if (scale > 1) return;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) onPrev();
    else onNext();
  };

  return (
    <div
      className="relative w-full h-full flex items-center justify-center bg-background overflow-hidden"
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="إغلاق"
        className="absolute top-3 left-3 z-20 rounded-full"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </Button>

      <img
        src={images[index]}
        alt={`${productName} - ${index + 1}`}
        draggable={false}
        className="max-w-full max-h-full object-contain transition-transform duration-150 ease-out select-none"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          cursor: scale > 1 ? "grab" : "zoom-in",
        }}
        onDoubleClick={() => {
          if (scale > 1) {
            setScale(1);
            setTranslate({ x: 0, y: 0 });
          } else {
            setScale(2);
          }
        }}
      />

      {images.length > 1 && (
        <>
          <Button
            variant="secondary"
            size="icon"
            aria-label="الصورة السابقة"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full"
            onClick={onPrev}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            aria-label="الصورة التالية"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full"
            onClick={onNext}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur px-3 py-1 rounded-full text-xs">
            {index + 1} / {images.length}
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto no-scrollbar px-2 py-1 rounded-full bg-background/70 backdrop-blur">
            {images.map((image, i) => (
              <button
                key={i}
                onClick={() => onIndex(i)}
                className={`shrink-0 w-14 h-14 rounded-md overflow-hidden border transition-all ${
                  i === index ? "border-primary ring-2 ring-primary/40" : "border-transparent opacity-60 hover:opacity-100"
                }`}
                aria-label={`صورة ${i + 1}`}
              >
                <img src={image} alt={`صورة ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* Zoom hint */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/70 backdrop-blur px-3 py-1 rounded-full flex items-center gap-1">
        <ZoomIn className="h-3 w-3" />
        <span className="hidden md:inline">مرر بالعجلة أو انقر مرتين للتكبير</span>
        <span className="md:hidden">اضغط مرتين أو باعد بإصبعيك للتكبير</span>
      </div>
    </div>
  );
};

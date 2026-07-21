import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Megaphone } from "lucide-react";
import { useAdTracking } from "@/hooks/useAdTracking";
import type { NativeAd } from "@/hooks/useNativeAds";

interface NativeAdCardProps {
  ad?: NativeAd;
  // Fallback props when no dynamic ad is provided
  title?: string;
  description?: string;
  image?: string;
  ctaText?: string;
  ctaUrl?: string;
  sponsorName?: string;
  slot?: string;
}

const NativeAdCard = memo(({
  ad,
  title,
  description,
  image,
  ctaText,
  ctaUrl,
  sponsorName,
  slot,
}: NativeAdCardProps) => {
  const navigate = useNavigate();
  const adTitle = ad?.title || title || "منتج مميز - إعلان";
  const adDescription = ad?.description || description || "اكتشف أفضل العروض والمنتجات المميزة من شركائنا";
  const adImage = ad?.image_url || image || "/placeholder.svg";
  const adCtaText = ad?.cta_text || ctaText || "تسوق الآن";
  const rawCtaUrl = ad?.cta_url ?? ctaUrl ?? null;
  // Only internal application paths are allowed; anything else is treated as no destination.
  const adCtaUrl = rawCtaUrl && rawCtaUrl.startsWith("/") ? rawCtaUrl : null;
  const hasDestination = Boolean(adCtaUrl);

  // Detect destination type from the internal path for accessibility / labelling.
  const destinationType: "category" | "store" | "promotion" | "product" | "page" | null = (() => {
    if (!adCtaUrl) return null;
    if (adCtaUrl.startsWith("/category/") || adCtaUrl.startsWith("/subcategory/")) return "category";
    if (adCtaUrl.startsWith("/vendor/")) return "store";
    if (adCtaUrl.startsWith("/product/")) return "product";
    if (adCtaUrl.startsWith("/#daily-deals") || adCtaUrl.startsWith("/deals")) return "promotion";
    return "page";
  })();
  const adSponsor = ad?.sponsor_name || sponsorName || "إعلان ممول";
  const adSlot = slot || (ad ? `native-${ad.id}` : "native-fallback");

  const { ref, trackClick } = useAdTracking(adSlot);

  const handleClick = () => {
    if (!hasDestination) return;
    trackClick();
    // Hash targets on the home page: navigate then smooth-scroll to the anchor.
    const url = adCtaUrl!;
    const hashIndex = url.indexOf("#");
    if (hashIndex >= 0) {
      const pathname = url.slice(0, hashIndex) || "/";
      const hash = url.slice(hashIndex + 1);
      navigate(pathname);
      // Defer to next tick so the target section is mounted.
      requestAnimationFrame(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    navigate(url);
  };

  return (
    <div
      ref={ref}
      className={`group relative rounded-xl overflow-hidden bg-card border border-dashed border-primary/30 transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        hasDestination
          ? "cursor-pointer hover:border-primary/50 hover:shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.2)]"
          : "opacity-90"
      }`}
      onClick={hasDestination ? handleClick : undefined}
      role={hasDestination ? "link" : undefined}
      aria-label={hasDestination && destinationType ? `${adTitle} — ${
        destinationType === "category" ? "الانتقال إلى الفئة" :
        destinationType === "store" ? "الانتقال إلى المتجر" :
        destinationType === "promotion" ? "الانتقال إلى العروض" :
        destinationType === "product" ? "الانتقال إلى المنتج" : "فتح"
      }` : undefined}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10">
        {/* Sponsored Badge */}
        <div className="absolute top-2 left-2 z-10">
          <Badge
            variant="outline"
            className="bg-background/90 backdrop-blur-sm text-muted-foreground text-[10px] px-1.5 py-0.5 gap-1 border-primary/20"
          >
            <Megaphone className="h-2.5 w-2.5" />
            {adSponsor}
          </Badge>
        </div>

        {/* Ad Image */}
        <img
          src={adImage}
          alt={adTitle}
          loading="lazy"
          className="object-cover w-full h-full transition-all duration-700 ease-out group-hover:scale-110"
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
      </div>

      {/* Content */}
      <div className="p-3 space-y-1.5">
        <h3 className="font-semibold text-xs leading-snug line-clamp-2 min-h-[2rem] text-foreground group-hover:text-primary transition-colors duration-300">
          {adTitle}
        </h3>

        <p className="text-[11px] text-muted-foreground line-clamp-2">
          {adDescription}
        </p>

        <Button
          variant="outline"
          disabled={!hasDestination}
          aria-disabled={!hasDestination}
          className="w-full rounded-lg font-semibold text-xs h-8 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group/btn active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
        >
          {hasDestination ? (
            <>
              <ArrowLeft className="h-3.5 w-3.5 ml-1.5 transition-transform duration-300 group-hover/btn:-translate-x-0.5" />
              {adCtaText}
            </>
          ) : (
            "المحتوى غير متوفر"
          )}
        </Button>
      </div>
    </div>
  );
});

NativeAdCard.displayName = "NativeAdCard";

export default NativeAdCard;
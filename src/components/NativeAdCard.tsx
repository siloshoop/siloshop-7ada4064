import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Megaphone } from "lucide-react";

interface NativeAdCardProps {
  title?: string;
  description?: string;
  image?: string;
  ctaText?: string;
  ctaUrl?: string;
  sponsorName?: string;
}

const NativeAdCard = memo(({
  title = "منتج مميز - إعلان",
  description = "اكتشف أفضل العروض والمنتجات المميزة من شركائنا",
  image = "/placeholder.svg",
  ctaText = "تسوق الآن",
  ctaUrl = "#",
  sponsorName = "إعلان ممول",
}: NativeAdCardProps) => {
  return (
    <div
      className="group relative cursor-pointer rounded-xl overflow-hidden bg-card border border-dashed border-primary/30 hover:border-primary/50 transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.2)]"
      onClick={() => {
        if (ctaUrl && ctaUrl !== "#") window.open(ctaUrl, "_blank");
      }}
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
            {sponsorName}
          </Badge>
        </div>

        {/* Ad Image */}
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="object-cover w-full h-full transition-all duration-700 ease-out group-hover:scale-110"
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
      </div>

      {/* Content */}
      <div className="p-3 space-y-1.5">
        {/* Title */}
        <h3 className="font-semibold text-xs leading-snug line-clamp-2 min-h-[2rem] text-foreground group-hover:text-primary transition-colors duration-300">
          {title}
        </h3>

        {/* Description */}
        <p className="text-[11px] text-muted-foreground line-clamp-2">
          {description}
        </p>

        {/* CTA Button */}
        <Button
          variant="outline"
          className="w-full rounded-lg font-semibold text-xs h-8 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group/btn active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            if (ctaUrl && ctaUrl !== "#") window.open(ctaUrl, "_blank");
          }}
        >
          <ExternalLink className="h-3.5 w-3.5 ml-1.5 transition-transform duration-300 group-hover/btn:scale-110" />
          {ctaText}
        </Button>
      </div>
    </div>
  );
});

NativeAdCard.displayName = "NativeAdCard";

export default NativeAdCard;
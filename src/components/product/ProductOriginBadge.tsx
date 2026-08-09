import { Badge } from "@/components/ui/badge";
import { BadgeCheck, MapPin, Truck } from "lucide-react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

interface Props {
  productType?: string | null;
  shipsWithinDays?: number | null;
  /** compact = single small badge for product cards */
  compact?: boolean;
  className?: string;
}

/**
 * Origin trust badges.
 *  - Seller products  → "بائع محلي" (Phase 1, always visible)
 *  - Platform products → 🇹🇷 imported badges, only once `platform_marketplace` is on
 */
const ProductOriginBadge = ({ productType, shipsWithinDays, compact, className }: Props) => {
  const { isEnabled } = useFeatureFlags();
  const isPlatform = productType === "platform";

  if (isPlatform && !isEnabled("platform_marketplace")) return null;

  if (compact) {
    return (
      <Badge
        variant="secondary"
        className={`gap-1 px-1.5 py-0 text-[10px] font-medium ${className ?? ""}`}
      >
        {isPlatform ? (
          <>
            <span aria-hidden>🇹🇷</span> مستورد من تركيا
          </>
        ) : (
          <>
            <MapPin className="h-2.5 w-2.5" /> بائع محلي
          </>
        )}
      </Badge>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      {isPlatform ? (
        <>
          <Badge className="gap-1 border-0 bg-gradient-to-r from-primary to-accent text-primary-foreground">
            <span aria-hidden>🇹🇷</span> مستورد من تركيا
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <BadgeCheck className="h-3.5 w-3.5" /> منتج أصلي
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Truck className="h-3.5 w-3.5" />
            {shipsWithinDays && shipsWithinDays > 0
              ? `التوصيل المتوقع: ${shipsWithinDays} يوم`
              : "التوصيل المتوقع: 7-14 يوم"}
          </Badge>
        </>
      ) : (
        <>
          <Badge className="gap-1 border-0 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
            <MapPin className="h-3.5 w-3.5" /> بائع محلي
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <BadgeCheck className="h-3.5 w-3.5" /> بائع موثّق
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Truck className="h-3.5 w-3.5" />
            {shipsWithinDays && shipsWithinDays > 0
              ? `يشحن خلال ${shipsWithinDays} أيام`
              : "توصيل لجميع المحافظات"}
          </Badge>
        </>
      )}
    </div>
  );
};

export default ProductOriginBadge;

import { Badge } from "@/components/ui/badge";
import { BadgeCheck, Truck } from "lucide-react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

interface Props {
  productType?: string | null;
  shipsWithinDays?: number | null;
  className?: string;
}

/**
 * Premium trust badges for Platform (imported) products. Rendered only when the
 * `platform_marketplace` feature flag is enabled — during Phase 1 nothing shows.
 */
const PlatformProductBadges = ({ productType, shipsWithinDays, className }: Props) => {
  const { isEnabled } = useFeatureFlags();
  if (productType !== "platform" || !isEnabled("platform_marketplace")) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <Badge className="gap-1 bg-gradient-to-r from-primary to-accent text-primary-foreground border-0">
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
    </div>
  );
};

export default PlatformProductBadges;

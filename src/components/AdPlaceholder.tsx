import { memo } from "react";

type AdSize = "banner" | "leaderboard" | "rectangle" | "interstitial" | "native";

interface AdPlaceholderProps {
  size: AdSize;
  slot?: string;
  className?: string;
  label?: string;
}

const adSizeMap: Record<AdSize, { width: string; height: string; label: string }> = {
  banner: { width: "w-full", height: "h-[60px] sm:h-[90px]", label: "بانر إعلاني" },
  leaderboard: { width: "w-full", height: "h-[90px] sm:h-[90px]", label: "إعلان عريض" },
  rectangle: { width: "w-full max-w-[336px]", height: "h-[280px]", label: "إعلان مربع" },
  interstitial: { width: "w-full", height: "h-[250px] sm:h-[300px]", label: "إعلان بيني" },
  native: { width: "w-full", height: "h-auto min-h-[120px]", label: "إعلان أصلي" },
};

/**
 * Ad Placeholder Component
 * 
 * Ready-to-replace ad slots. When connecting to an ad network:
 * 1. Replace the placeholder content with the ad network's script/component
 * 2. Use the `slot` prop to pass ad unit IDs
 * 
 * Sizes:
 * - banner: 320x50 / 728x90 (top/bottom of pages)
 * - leaderboard: 728x90 (between sections)  
 * - rectangle: 300x250 / 336x280 (sidebar, in-feed)
 * - interstitial: full-width overlay (between page transitions)
 * - native: flexible (in-feed, blends with content)
 */
const AdPlaceholder = memo(({ size, slot, className = "", label }: AdPlaceholderProps) => {
  const config = adSizeMap[size];
  const displayLabel = label || config.label;

  return (
    <div
      className={`${config.width} ${config.height} mx-auto flex items-center justify-center bg-muted/40 border border-dashed border-border/60 rounded-lg overflow-hidden ${className}`}
      data-ad-slot={slot}
      data-ad-size={size}
    >
      <div className="text-center px-4">
        <div className="text-xs text-muted-foreground/60 font-medium">{displayLabel}</div>
        {slot && <div className="text-[10px] text-muted-foreground/40 mt-0.5">Slot: {slot}</div>}
      </div>
    </div>
  );
});

AdPlaceholder.displayName = "AdPlaceholder";

export default AdPlaceholder;

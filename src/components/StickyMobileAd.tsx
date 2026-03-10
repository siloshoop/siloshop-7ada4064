import { memo } from "react";
import AdPlaceholder from "./AdPlaceholder";

/**
 * Sticky ad that appears at the bottom of mobile screens,
 * positioned above the MobileBottomNav (h-14 = 56px).
 */
const StickyMobileAd = memo(() => {
  return (
    <div className="md:hidden fixed bottom-14 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border/40 px-2 py-1 safe-area-bottom">
      <AdPlaceholder
        size="banner"
        slot="sticky-mobile-bottom"
        label="إعلان ثابت"
        className="!h-[50px] !rounded-md"
      />
    </div>
  );
});

StickyMobileAd.displayName = "StickyMobileAd";

export default StickyMobileAd;

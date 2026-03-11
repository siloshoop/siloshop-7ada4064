import { memo, useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import AdPlaceholder from "./AdPlaceholder";

const DISMISS_DURATION = 5 * 60 * 1000; // 5 minutes

const StickyMobileAd = memo(() => {
  const [dismissed, setDismissed] = useState(() => {
    const dismissedAt = localStorage.getItem("sticky-ad-dismissed-at");
    if (!dismissedAt) return false;
    return Date.now() - Number(dismissedAt) < DISMISS_DURATION;
  });
  const [visible, setVisible] = useState(!dismissed);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!dismissed) {
      // Small delay for enter animation
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    }
    const dismissedAt = Number(localStorage.getItem("sticky-ad-dismissed-at") || Date.now());
    const remaining = DISMISS_DURATION - (Date.now() - dismissedAt);
    if (remaining <= 0) {
      setDismissed(false);
      localStorage.removeItem("sticky-ad-dismissed-at");
      return;
    }
    const timer = setTimeout(() => {
      setDismissed(false);
      localStorage.removeItem("sticky-ad-dismissed-at");
    }, remaining);
    return () => clearTimeout(timer);
  }, [dismissed]);

  const handleDismiss = useCallback(() => {
    setAnimating(true);
    setVisible(false);
    setTimeout(() => {
      localStorage.setItem("sticky-ad-dismissed-at", String(Date.now()));
      setDismissed(true);
      setAnimating(false);
    }, 300);
  }, []);

  if (dismissed && !animating) return null;

  return (
    <div
      className={`md:hidden fixed bottom-14 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border/40 px-2 py-1 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
    >
      <button
        onClick={handleDismiss}
        className={`absolute -top-6 right-2 z-50 bg-muted/90 backdrop-blur-sm text-muted-foreground hover:text-foreground rounded-t-md px-2 py-0.5 text-xs flex items-center gap-0.5 border border-b-0 border-border/40 transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
        aria-label="إغلاق الإعلان"
      >
        <X className="h-3 w-3" />
        إغلاق
      </button>
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

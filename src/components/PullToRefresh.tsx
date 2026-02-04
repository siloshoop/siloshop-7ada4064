import { RefreshCw, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
}

const PullToRefreshIndicator = ({
  pullDistance,
  isRefreshing,
  progress,
}: PullToRefreshIndicatorProps) => {
  if (pullDistance === 0 && !isRefreshing) return null;

  const isReady = progress >= 1;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none md:hidden"
      style={{
        transform: `translateY(${Math.min(pullDistance, 100)}px)`,
        opacity: Math.min(progress, 1),
      }}
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center w-14 h-14 rounded-full glass shadow-lg transition-all duration-300",
          isRefreshing && "bg-primary/20 animate-pulse-glow",
          isReady && !isRefreshing && "bg-primary/10 scale-110"
        )}
      >
        {isRefreshing ? (
          <RefreshCw className="w-6 h-6 text-primary animate-spin" />
        ) : (
          <>
            <ArrowDown 
              className={cn(
                "w-5 h-5 text-primary transition-transform duration-300",
                isReady && "rotate-180"
              )}
            />
            <span className="text-[10px] text-primary font-medium mt-0.5">
              {isReady ? "أفلت" : "اسحب"}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;

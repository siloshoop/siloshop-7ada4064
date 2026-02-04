import { RefreshCw } from "lucide-react";
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
          "flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20 shadow-lg",
          isRefreshing && "bg-primary/20"
        )}
      >
        <RefreshCw
          className={cn(
            "w-5 h-5 text-primary transition-transform",
            isRefreshing && "animate-spin"
          )}
          style={{
            transform: isRefreshing
              ? undefined
              : `rotate(${progress * 360}deg)`,
          }}
        />
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;

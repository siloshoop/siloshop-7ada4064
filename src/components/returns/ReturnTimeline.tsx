import { cn } from "@/lib/utils";
import { Check, XCircle } from "lucide-react";
import { RETURN_TIMELINE, RETURN_STATUS, returnTimelineIndex } from "@/lib/returnStatus";

interface Props {
  status: string;
  className?: string;
}

/** Horizontal (mobile-stacked) timeline for the return lifecycle. */
const ReturnTimeline = ({ status, className }: Props) => {
  if (status === "rejected") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm",
          className
        )}
        dir="rtl"
      >
        <XCircle className="h-4 w-4 text-destructive" />
        <span className="font-medium">تم رفض طلب الإرجاع</span>
      </div>
    );
  }

  const currentIndex = returnTimelineIndex(status);

  return (
    <ol className={cn("flex flex-wrap gap-x-1 gap-y-2", className)} dir="rtl">
      {RETURN_TIMELINE.map((key, i) => {
        const done = currentIndex > i;
        const active = currentIndex === i;
        return (
          <li key={key} className="flex min-w-[70px] flex-1 flex-col items-center gap-1">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary animate-pulse",
                !done && !active && "border-border text-muted-foreground"
              )}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-center text-[10px] leading-tight sm:text-xs",
                active ? "font-semibold text-primary" : "text-muted-foreground"
              )}
            >
              {RETURN_STATUS[key]?.label ?? key}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

export default ReturnTimeline;

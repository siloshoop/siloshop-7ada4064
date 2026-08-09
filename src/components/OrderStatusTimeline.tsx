import { cn } from "@/lib/utils";
import { Check, XCircle, RotateCcw } from "lucide-react";
import { ORDER_STEPS, ORDER_STATUS_LABELS, normalizeStatus, statusClasses } from "@/lib/orderStatus";

export { ORDER_STEPS, ORDER_STATUS_LABELS };

interface Props {
  status: string;
  latestNote?: string | null;
  className?: string;
}

const OrderStatusTimeline = ({ status, latestNote, className }: Props) => {
  const current = normalizeStatus(status);
  const isCancelled = current === "cancelled";
  const isReturned = current === "returned";

  if (isCancelled || isReturned) {
    const Icon = isCancelled ? XCircle : RotateCcw;
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border p-4",
          isCancelled ? "border-destructive/40 bg-destructive/5" : "border-amber-500/40 bg-amber-500/5",
          className
        )}
        dir="rtl"
      >
        <Icon className={cn("h-6 w-6 shrink-0", isCancelled ? "text-destructive" : "text-amber-600")} />
        <div>
          <p className="font-semibold">{isCancelled ? "تم إلغاء هذا الطلب" : "تم إرجاع هذا الطلب"}</p>
          {latestNote && <p className="text-sm text-muted-foreground mt-1">{latestNote}</p>}
        </div>
      </div>
    );
  }

  const currentIndex = Math.max(0, ORDER_STEPS.findIndex((s) => s.key === current));

  return (
    <div className={cn("w-full", className)} dir="rtl">
      <div className="flex items-start justify-between gap-1">
        {ORDER_STEPS.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          const Icon = step.icon;
          const c = statusClasses(step.key);
          return (
            <div key={step.key} className="flex-1 flex flex-col items-center relative min-w-0">
              {i > 0 && (
                <span
                  className={cn(
                    "absolute top-4 right-1/2 left-1/2 h-0.5 -z-0",
                    i <= currentIndex ? "bg-primary" : "bg-border"
                  )}
                  style={{ right: "50%", left: "-50%" }}
                  aria-hidden
                />
              )}
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                  done && cn(c.bg, c.border, "text-background"),
                  active && cn(c.border, c.text, "bg-background animate-pulse"),
                  !done && !active && "border-border text-muted-foreground bg-background"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  "mt-2 text-[10px] sm:text-xs text-center leading-tight",
                  active ? cn(c.text, "font-semibold") : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {latestNote && (
        <p className="mt-4 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          آخر تحديث: {latestNote}
        </p>
      )}
    </div>
  );
};

export default OrderStatusTimeline;

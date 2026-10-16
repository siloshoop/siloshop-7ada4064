import { Check, RotateCcw, XCircle } from "lucide-react";
import { PRODUCT_TRACKING_STEPS, normalizeProductTracking, productTrackingProgress, type ProductTrackingHistory } from "@/lib/productTracking";
import { cn } from "@/lib/utils";

const terminalLabels: Record<string, string> = {
  cancelled: "تم إلغاء المنتج", return_requested: "تم تقديم طلب إرجاع",
  returning: "المنتج قيد الإرجاع", returned: "تم إرجاع المنتج",
  refunded: "تم رد المبلغ إلى العميل",
};

/** Tracking-page-only timeline. Every state is derived from the saved status. */
export default function ShipmentTrackingTimeline({ status, history = [] }: { status: string | null; history?: ProductTrackingHistory[] }) {
  const current = normalizeProductTracking(status);
  if (current && terminalLabels[current]) {
    const Icon = current === "cancelled" ? XCircle : RotateCcw;
    return <div className="flex items-center gap-3 border border-destructive/40 bg-destructive/5 rounded-lg p-3 text-sm" dir="rtl">
      <Icon className="h-5 w-5 shrink-0 text-destructive" />{terminalLabels[current]}
    </div>;
  }
  const currentIndex = PRODUCT_TRACKING_STEPS.findIndex((step) => step.key === current);
  if (currentIndex < 0 && current !== "pending") return <p className="text-sm text-muted-foreground">حالة الشحنة غير متاحة</p>;

  return <ol className="space-y-0" dir="rtl" aria-label="مراحل الشحنة">
    {productTrackingProgress(status).map((step, index) => {
      const done = step.state === "completed";
      const active = step.state === "current" || (step.key === "delivered" && current === "delivered");
      const timestamp = history.find((entry) => normalizeProductTracking(entry.status) === step.key)?.created_at;
      const Icon = done ? Check : step.icon;
      return <li key={step.key} data-step={step.key} data-state={done ? "completed" : active ? "current" : "future"}
        aria-current={active ? "step" : undefined} className="relative flex min-h-12 items-start gap-3 pb-3 last:pb-0">
        {index < PRODUCT_TRACKING_STEPS.length - 1 && <span aria-hidden="true" className={cn(
          "absolute right-[15px] top-8 bottom-0 w-0.5", index < currentIndex ? "bg-primary" : "bg-border",
        )} />}
        <span className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
          done ? "border-primary bg-primary text-primary-foreground" : active
            ? "border-primary bg-primary/10 text-primary ring-4 ring-primary/10"
            : "border-border bg-background text-muted-foreground") }>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 pt-1 text-sm leading-5">
          <span className={cn(active ? "font-semibold text-primary" : done ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
          {active && <span className="mr-2 text-xs text-primary">{done ? "تم الاكتمال" : "الحالة الحالية"}</span>}
          {timestamp && <time dateTime={timestamp} className="block text-xs text-muted-foreground">{new Date(timestamp).toLocaleString("ar-SY")}</time>}
        </div>
      </li>;
    })}
  </ol>;
}
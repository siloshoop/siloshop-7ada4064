/** Arabic labels + styling for stock movement reasons (Phase 7: inventory movement log). */
export type StockMovementReason = "manual" | "sale" | "return" | "admin_adjustment" | "system";

export const STOCK_REASON_LABELS: Record<string, string> = {
  manual: "تعديل يدوي من البائع",
  sale: "خصم بعد عملية بيع",
  return: "إرجاع إلى المخزون",
  admin_adjustment: "تعديل من الإدارة",
  system: "تحديث تلقائي",
};

export const stockReasonLabel = (reason: string) => STOCK_REASON_LABELS[reason] ?? reason;

export const stockReasonVariant = (reason: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (reason) {
    case "manual": return "outline";
    case "sale": return "secondary";
    case "return": return "default";
    case "admin_adjustment": return "destructive";
    default: return "secondary";
  }
};

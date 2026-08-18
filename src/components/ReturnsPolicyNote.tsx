import { Link } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ملخص مختصر لسياسة الإرجاع يظهر قبل الشراء (صفحة المنتج والدفع).
 * القواعد مطابقة لصفحة /returns: نافذة 7 أيام، المنتج بحالته الأصلية،
 * وتكلفة إعادة الشحن على المشتري ما لم يكن المنتج تالفًا أو مخالفًا للوصف.
 */
const ReturnsPolicyNote = ({ className }: { className?: string }) => (
  <div
    className={cn("rounded-xl border bg-muted/40 p-4 text-sm", className)}
    dir="rtl"
  >
    <div className="flex items-start gap-3">
      <RotateCcw className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="font-semibold">سياسة الإرجاع</p>
        <ul className="text-muted-foreground space-y-1 list-disc pr-4">
          <li>إمكانية طلب الإرجاع خلال 7 أيام من تاريخ الاستلام.</li>
          <li>يجب أن يكون المنتج بحالته الأصلية مع التغليف والملحقات.</li>
          <li>
            تكلفة إعادة الشحن على المشتري، إلا إذا كان المنتج تالفًا أو مخالفًا للوصف
            فتكون على البائع.
          </li>
        </ul>
        <Link to="/returns" className="inline-block text-primary hover:underline">
          عرض سياسة الإرجاع كاملة
        </Link>
      </div>
    </div>
  </div>
);

export default ReturnsPolicyNote;

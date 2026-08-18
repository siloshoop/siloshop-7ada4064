import { Truck, RotateCcw, Banknote, MapPin, Clock } from "lucide-react";

interface Props {
  shippingCost?: number | null;
  shipsWithinDays?: number | null;
  isPlatform?: boolean;
}

/** Shipping details + return policy summary for the product page. */
const ShippingReturnsInfo = ({ shippingCost, shipsWithinDays, isPlatform }: Props) => {
  const freeShipping = shippingCost === 0 || shippingCost === null || shippingCost === undefined;

  const rows = [
    {
      icon: Truck,
      title: "تكلفة الشحن",
      value: freeShipping
        ? "شحن مجاني"
        : `${Number(shippingCost).toLocaleString()} ل.س — يحددها البائع لكل منتج`,
    },
    {
      icon: Clock,
      title: "مدة التحضير والتوصيل",
      value: shipsWithinDays && shipsWithinDays > 0
        ? `يتم تحضير الطلب وشحنه خلال ${shipsWithinDays} أيام`
        : isPlatform
        ? "التوصيل المتوقع 7-14 يوم عمل"
        : "يتم التحضير والشحن عادة خلال 1-3 أيام عمل",
    },
    { icon: MapPin, title: "مناطق التوصيل", value: "توصيل إلى جميع المحافظات السورية" },
    {
      icon: Banknote,
      title: "طريقة الدفع",
      value: isPlatform
        ? "الدفع عبر شام كاش لمنتجات المنصة"
        : "الدفع نقداً عند الاستلام (COD) فقط",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Truck className="h-4 w-4 text-primary" /> معلومات الشحن
        </h3>
        <dl className="space-y-3">
          {rows.map(({ icon: Icon, title, value }) => (
            <div key={title} className="flex gap-2.5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="text-sm">
                <dt className="font-medium">{title}</dt>
                <dd className="text-muted-foreground">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <RotateCcw className="h-4 w-4 text-primary" /> سياسة الإرجاع
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>يمكنك طلب الإرجاع خلال 7 أيام من تاريخ الاستلام.</li>
          <li>يجب أن يكون المنتج بحالته الأصلية مع العلبة والملحقات.</li>
          <li>ترسل طلب الإرجاع من صفحة «طلباتي» مع ذكر السبب وإرفاق صور.</li>
          <li>بعد موافقة البائع يزوّدك بتعليمات الإرجاع، ويكتمل الطلب بعد فحص المنتج.</li>
          <li>تتابع حالة طلب الإرجاع في أي وقت من صفحة «طلباتي».</li>
        </ul>
      </div>
    </div>
  );
};

export default ShippingReturnsInfo;

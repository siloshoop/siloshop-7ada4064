import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { currencyName, formatPrice, normalizeCurrency, type ProductCurrency } from "@/lib/currency";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

const money = (n: number, currency?: string | null) =>
  formatPrice(n, currency, { maximumFractionDigits: 0 });

const statusLabels: Record<string, string> = {
  pending: "قيد المعالجة",
  confirmed: "مؤكد",
  processing: "قيد التحضير",
  shipped: "تم الشحن",
  out_for_delivery: "تم تسليم الطلب إلى مركز الشحن",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
};

const docStyles = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, "Segoe UI", Tahoma, sans-serif; direction: rtl; color: #111; margin: 0; padding: 16px; background: #fff; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #555; font-size: 12px; }
  .box { border: 1px solid #999; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
  .row { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: right; }
  th { background: #f2f2f2; }
  .totals { margin-top: 12px; width: 100%; max-width: 320px; margin-inline-start: auto; font-size: 14px; }
  .totals .row { padding: 3px 0; }
  .totals .grand { font-size: 17px; font-weight: 700; border-top: 2px solid #333; padding-top: 6px; margin-top: 4px; }
  .note { font-size: 11px; color: #666; margin-top: 16px; text-align: center; }
`;

interface Props {
  orderId: string;
}

const CustomerInvoice = ({ orderId }: Props) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*, profiles:customer_id(full_name)")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError || !order) {
        throw orderError || new Error("لم يتم العثور على الطلب");
      }

      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select("quantity, price, currency, variant_label, product_name, subtotal, discount_amount, product:products(name)")
        .eq("order_id", orderId);

      if (itemsError) throw itemsError;

      const w = window.open("", "_blank", "width=900,height=700");
      if (!w) {
        toast({
          title: "تعذر فتح نافذة الطباعة",
          description: "يرجى السماح بالنوافذ المنبثقة والمحاولة مجددًا",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const orderNumber = (order as any).order_number || `#${order.id.slice(0, 8).toUpperCase()}`;
      const invoiceNumber = (order as any).invoice_number || orderNumber;
      const date = new Date(order.created_at).toLocaleDateString("ar-SY", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const orderItems = items || [];
      const orderCurrency = normalizeCurrency((order as any).currency);

      // Group items by their own currency — amounts in different currencies are
      // never added together and never converted.
      const groups = new Map<ProductCurrency, any[]>();
      for (const it of orderItems as any[]) {
        const cur = normalizeCurrency(it.currency ?? (order as any).currency);
        groups.set(cur, [...(groups.get(cur) || []), it]);
      }
      if (groups.size === 0) groups.set(orderCurrency, []);

      const orderShipping = Number((order as any).shipping_amount || 0);
      const orderDiscount = Number((order as any).discount_amount || 0);
      const orderTax = Number((order as any).tax_amount || 0);

      const blocks = Array.from(groups.entries()).map(([currency, list]) => {
        const itemsTotal = list.reduce(
          (s, i: any) => s + (i.subtotal != null ? Number(i.subtotal) : Number(i.price) * i.quantity),
          0,
        );
        const itemsDiscount = list.reduce((s, i: any) => s + Number(i.discount_amount || 0), 0);
        // Order-level shipping / coupon / tax are recorded in the order currency only.
        const isOrderCurrency = currency === orderCurrency;
        const subtotal =
          groups.size === 1 ? Number((order as any).subtotal_amount || 0) || itemsTotal : itemsTotal;
        const discount = isOrderCurrency ? orderDiscount || (groups.size === 1 ? itemsDiscount : 0) : 0;
        const shipping = isOrderCurrency ? orderShipping : 0;
        const tax = isOrderCurrency ? orderTax : 0;
        const total =
          groups.size === 1 && Number(order.total_amount || 0)
            ? Number(order.total_amount)
            : Math.max(0, subtotal - discount) + shipping + tax;
        return { currency, list, subtotal, discount, shipping, tax, total };
      });

      const multi = blocks.length > 1;
      const customerName = (order as any).profiles?.full_name || "غير متوفر";
      const statusLabel = statusLabels[order.status || "pending"] || "قيد المعالجة";

      const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
        <title>فاتورة الطلب ${esc(orderNumber)}</title>
        <style>${docStyles}</style></head><body>
        <div class="box">
          <div class="row">
            <div>
              <h1>سيلو شوب</h1>
              <div class="muted">فاتورة الطلب ${esc(orderNumber)}</div>
              <div class="muted">رقم الفاتورة: ${esc(invoiceNumber)}</div>
            </div>
            <div style="text-align:left">
              <div class="muted">تاريخ الطلب: ${esc(date)}</div>
              <div class="muted">الحالة: ${esc(statusLabel)}</div>
            </div>
          </div>
        </div>
        <div class="box">
          <div class="row">
            <div>
              <div><strong>العميل:</strong> ${esc(customerName)}</div>
              ${order.phone ? `<div dir="ltr" style="text-align:right"><strong>الهاتف:</strong> ${esc(order.phone)}</div>` : ""}
            </div>
            <div>
              ${order.shipping_address ? `<div><strong>عنوان التوصيل:</strong> ${esc(order.shipping_address)}</div>` : ""}
            </div>
          </div>
        </div>
        <table>
          <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
          <tbody>
            ${orderItems
              .map(
                (i: any) => `<tr>
                  <td>${esc(i.product_name || i.product?.name || "منتج")}${i.variant_label ? ` <span class="muted">(${esc(i.variant_label)})</span>` : ""}</td>
                  <td>${i.quantity}</td>
                  <td>${esc(money(i.price))}</td>
                  <td>${esc(money(i.subtotal != null ? i.subtotal : i.quantity * i.price))}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
        <div class="totals">
          <div class="row"><span>المنتجات</span><span>${esc(money(subtotal))}</span></div>
          ${discount > 0 ? `<div class="row"><span>الخصم</span><span>-${esc(money(discount))}</span></div>` : ""}
          <div class="row"><span>الشحن</span><span>${shipping > 0 ? esc(money(shipping)) : "مجاني"}</span></div>
          ${tax > 0 ? `<div class="row"><span>الضريبة</span><span>${esc(money(tax))}</span></div>` : ""}
          <div class="row grand"><span>الإجمالي</span><span>${esc(money(total))}</span></div>
        </div>
        ${order.payment_method === "cod" ? `<div class="note"><strong>طريقة الدفع:</strong> الدفع عند الاستلام</div>` : ""}
        <div class="note">شكرًا لتسوقكم من سيلو شوب — هذه الفاتورة صادرة إلكترونيًا ولا تحتاج إلى توقيع أو ختم.</div>
        <script>window.onload = function(){ window.focus(); window.print(); };</script>
      </body></html>`;

      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (error: any) {
      console.error("Invoice load error:", error);
      toast({
        title: "تعذر تحميل الفاتورة",
        description: error?.message || "حدث خطأ أثناء تحميل بيانات الطلب",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full gap-2 sm:w-auto"
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      تحميل الفاتورة
    </Button>
  );
};

export default CustomerInvoice;

import { Button } from "@/components/ui/button";
import { Printer, Tag } from "lucide-react";

export interface PrintOrderItem {
  name: string;
  quantity: number;
  price: number;
  sku?: string | null;
  barcode?: string | null;
}

export interface PrintOrderData {
  id: string;
  created_at: string;
  status: string;
  customer_name: string | null;
  city: string | null;
  items: PrintOrderItem[];
  storeName?: string | null;
}

/* --- Minimal Code 39 barcode as inline SVG (no external deps) --- */
const CODE39: Record<string, string> = {
  "0": "101001101101", "1": "110100101011", "2": "101100101011", "3": "110110010101",
  "4": "101001101011", "5": "110100110101", "6": "101100110101", "7": "101001011011",
  "8": "110100101101", "9": "101100101101", A: "110101001011", B: "101101001011",
  C: "110110100101", D: "101011001011", E: "110101100101", F: "101101100101",
  G: "101010011011", H: "110101001101", I: "101101001101", J: "101011001101",
  K: "110101010011", L: "101101010011", M: "110110101001", N: "101011010011",
  O: "110101101001", P: "101101101001", Q: "101010110011", R: "110101011001",
  S: "101101011001", T: "101011011001", U: "110010101011", V: "100110101011",
  W: "110011010101", X: "100101101011", Y: "110010110101", Z: "100110110101",
  "-": "100101011011", ".": "110010101101", " ": "100110101101", "*": "100101101101",
};

const barcodeSvg = (raw: string, height = 44) => {
  const value = `*${raw.toUpperCase().replace(/[^0-9A-Z\-. ]/g, "")}*`;
  const bits = value
    .split("")
    .map((ch) => CODE39[ch] ?? CODE39["-"])
    .join("0");
  const unit = 2;
  let x = 0;
  const bars: string[] = [];
  for (const bit of bits) {
    if (bit === "1") bars.push(`<rect x="${x}" y="0" width="${unit}" height="${height}" fill="#000"/>`);
    x += unit;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height}" viewBox="0 0 ${x} ${height}">${bars.join("")}</svg>`;
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

const money = (n: number) => `${Number(n || 0).toLocaleString("ar-SY")} ل.س`;

const docStyles = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, "Segoe UI", Tahoma, sans-serif; direction: rtl; color: #111; margin: 0; padding: 16px; background: #fff; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #555; font-size: 12px; }
  .box { border: 1px solid #999; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
  .row { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: right; }
  th { background: #f2f2f2; }
  .total { font-size: 16px; font-weight: 700; margin-top: 8px; text-align: left; }
  .label { width: 100mm; border: 2px dashed #333; padding: 12px; margin-top: 16px; page-break-inside: avoid; }
  .label .big { font-size: 18px; font-weight: 700; }
  .note { font-size: 11px; color: #666; margin-top: 10px; }
`;

const buildHtml = (order: PrintOrderData, mode: "invoice" | "label") => {
  const total = order.items.reduce((s, i) => s + i.quantity * i.price, 0);
  const shortId = order.id.slice(0, 8).toUpperCase();
  const date = new Date(order.created_at).toLocaleDateString("ar-SY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const invoice = `
    <div class="box">
      <div class="row">
        <div>
          <h1>فاتورة الطلب #${esc(shortId)}</h1>
          <div class="muted">تاريخ الطلب: ${esc(date)}</div>
          <div class="muted">المتجر: ${esc(order.storeName || "متجري على سيلو شوب")}</div>
        </div>
        <div>${barcodeSvg(shortId)}</div>
      </div>
    </div>
    <div class="box">
      <div class="row">
        <div><strong>العميل:</strong> ${esc(order.customer_name || "غير متوفر")}</div>
        <div><strong>المدينة:</strong> ${esc(order.city || "غير محددة")}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>المنتج</th><th>SKU / باركود</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
      <tbody>
        ${order.items
          .map(
            (i) => `<tr>
              <td>${esc(i.name)}</td>
              <td>${esc(i.sku || i.barcode || "-")}</td>
              <td>${i.quantity}</td>
              <td>${esc(money(i.price))}</td>
              <td>${esc(money(i.quantity * i.price))}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    <div class="total">إجمالي منتجاتك: ${esc(money(total))}</div>
    <div class="note">الدفع عند الاستلام. هذه الفاتورة خاصة بمنتجات هذا المتجر فقط داخل الطلب.</div>
  `;

  const label = `
    <div class="label">
      <div class="big">سيلو شوب — بطاقة شحن</div>
      <div class="muted">رقم الطلب</div>
      <div class="big">#${esc(shortId)}</div>
      ${barcodeSvg(shortId, 56)}
      <div style="margin-top:8px"><strong>المستلم:</strong> ${esc(order.customer_name || "غير متوفر")}</div>
      <div><strong>المدينة:</strong> ${esc(order.city || "غير محددة")}</div>
      <div><strong>عدد القطع:</strong> ${order.items.reduce((s, i) => s + i.quantity, 0)}</div>
      <div><strong>طريقة الدفع:</strong> الدفع عند الاستلام</div>
      <div class="note">العنوان الكامل ورقم الهاتف يتم تسليمهما لمندوب التوصيل عبر المنصة حمايةً لخصوصية العميل.</div>
    </div>
  `;

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
    <title>${mode === "invoice" ? "فاتورة" : "بطاقة شحن"} #${esc(shortId)}</title>
    <style>${docStyles}</style></head><body>
    ${mode === "invoice" ? invoice : label}
    <script>window.onload = function(){ window.focus(); window.print(); };</script>
  </body></html>`;
};

const openPrint = (order: PrintOrderData, mode: "invoice" | "label") => {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.open();
  w.document.write(buildHtml(order, mode));
  w.document.close();
};

interface Props {
  order: PrintOrderData;
}

/** Seller-facing print actions: A4 invoice and a shipping label (PII-minimised). */
const PrintOrderDocs = ({ order }: Props) => (
  <>
    <Button variant="outline" size="sm" className="gap-2" onClick={() => openPrint(order, "invoice")}>
      <Printer className="h-4 w-4" /> طباعة الفاتورة
    </Button>
    <Button variant="outline" size="sm" className="gap-2" onClick={() => openPrint(order, "label")}>
      <Tag className="h-4 w-4" /> بطاقة الشحن
    </Button>
  </>
);

export default PrintOrderDocs;

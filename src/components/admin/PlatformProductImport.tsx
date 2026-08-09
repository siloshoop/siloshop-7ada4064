import { useState } from "react";
// xlsx (~430 kB) is only needed when an admin actually parses or downloads a
// spreadsheet, so it is imported on demand.
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, AlertCircle } from "lucide-react";

interface Row {
  data: any;
  errors: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: { id: string; name: string; name_ar: string }[];
  brands: { id: string; name: string; name_ar: string }[];
  onImported: () => void;
}

const HEADER_MAP: Record<string, string> = {
  name: "name", "اسم المنتج": "name", الاسم: "name",
  sku: "sku",
  brand: "brand", "العلامة التجارية": "brand", "علامة تجارية": "brand",
  category: "category", الفئة: "category",
  description: "description", الوصف: "description",
  price: "price", السعر: "price",
  discount_price: "discount_price", "سعر الخصم": "discount_price",
  currency: "currency", العملة: "currency",
  stock_quantity: "stock_quantity", الكمية: "stock_quantity", stock: "stock_quantity",
  sizes: "sizes", المقاسات: "sizes",
  colors: "colors", الألوان: "colors",
  weight: "weight", الوزن: "weight",
  images: "images", الصور: "images",
  main_image: "main_image", "الصورة الرئيسية": "main_image",
  status: "status", الحالة: "status",
};

const splitList = (v: any): string[] => {
  if (!v) return [];
  return String(v)
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
};

const PlatformProductImport = ({ open, onOpenChange, categories, brands, onImported }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [sourceType, setSourceType] = useState<"csv" | "xlsx">("xlsx");

  const parse = async (file: File) => {
    setFileName(file.name);
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    setSourceType(isCsv ? "csv" : "xlsx");
    const buf = await file.arrayBuffer();
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

    const normalized: Row[] = raw.map((r) => {
      const norm: Record<string, any> = {};
      for (const k of Object.keys(r)) {
        const key = HEADER_MAP[k.trim().toLowerCase()] || HEADER_MAP[k.trim()];
        if (key) norm[key] = r[k];
      }
      const errors: string[] = [];
      if (!norm.name || !String(norm.name).trim()) errors.push("الاسم مطلوب");
      const price = Number(norm.price);
      if (!price || price <= 0) errors.push("السعر غير صالح");
      if (norm.brand) {
        const b = brands.find(
          (x) => x.name.toLowerCase() === String(norm.brand).toLowerCase() ||
            x.name_ar === String(norm.brand)
        );
        if (!b) errors.push(`علامة تجارية غير معروفة: ${norm.brand}`);
        else norm.__brand_id = b.id;
      }
      if (norm.category) {
        const c = categories.find(
          (x) => x.name.toLowerCase() === String(norm.category).toLowerCase() ||
            x.name_ar === String(norm.category)
        );
        if (!c) errors.push(`فئة غير معروفة: ${norm.category}`);
        else norm.__category_id = c.id;
      }
      return { data: norm, errors };
    });
    setRows(normalized);
  };

  const commit = async () => {
    if (!user) return;
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) {
      toast({ title: "لا توجد صفوف صالحة", variant: "destructive" });
      return;
    }
    setImporting(true);
    const payloads = valid.map(({ data }) => {
      const images = splitList(data.images);
      const main =
        (data.main_image && String(data.main_image).trim()) || images[0] || null;
      return {
        vendor_id: user.id,
        product_type: "platform",
        source: sourceType,
        name: String(data.name).trim(),
        sku: data.sku ? String(data.sku).trim() : null,
        brand_id: data.__brand_id || null,
        category_id: data.__category_id || null,
        description: data.description ? String(data.description) : null,
        price: Number(data.price),
        discount_price: data.discount_price ? Number(data.discount_price) : null,
        currency: (data.currency && String(data.currency).trim()) || "SYP",
        stock_quantity: Number(data.stock_quantity) || 0,
        sizes: splitList(data.sizes),
        colors: splitList(data.colors),
        weight: data.weight ? Number(data.weight) : null,
        images,
        image_url: main,
        is_active: String(data.status || "active").toLowerCase() !== "inactive",
      };
    });
    // Insert in chunks of 100
    let inserted = 0;
    for (let i = 0; i < payloads.length; i += 100) {
      const { error } = await supabase.from("products").insert(payloads.slice(i, i + 100));
      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
        setImporting(false);
        return;
      }
      inserted += Math.min(100, payloads.length - i);
    }
    setImporting(false);
    toast({ title: "تم الاستيراد", description: `تم استيراد ${inserted} منتج` });
    setRows([]);
    setFileName("");
    onImported();
    onOpenChange(false);
  };

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const headers = [
      "name","sku","brand","category","description","price","discount_price",
      "currency","stock_quantity","sizes","colors","weight","images","main_image","status",
    ];
    const example = [{
      name: "منتج تجريبي", sku: "SKU-001", brand: "", category: "",
      description: "وصف", price: 10000, discount_price: "", currency: "SYP",
      stock_quantity: 10, sizes: "S,M,L", colors: "أحمر,أزرق", weight: 0.5,
      images: "https://.../img1.jpg,https://.../img2.jpg",
      main_image: "https://.../img1.jpg", status: "active",
    }];
    const ws = XLSX.utils.json_to_sheet(example, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "products");
    XLSX.writeFile(wb, "platform_products_template.xlsx");
  };

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.length - validCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>استيراد منتجات من Excel / CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])}
              className="max-w-sm"
            />
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 ml-2" /> تحميل قالب
            </Button>
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex gap-3 text-sm">
                <span className="text-green-600">صالح: {validCount}</span>
                {errorCount > 0 && <span className="text-destructive">أخطاء: {errorCount}</span>}
                <span className="text-muted-foreground">من ملف: {fileName}</span>
              </div>
              <div className="border rounded-md max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-right">#</th>
                      <th className="p-2 text-right">الاسم</th>
                      <th className="p-2 text-right">السعر</th>
                      <th className="p-2 text-right">الفئة</th>
                      <th className="p-2 text-right">العلامة</th>
                      <th className="p-2 text-right">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={r.errors.length ? "bg-destructive/5" : ""}>
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2">{r.data.name || "—"}</td>
                        <td className="p-2">{r.data.price || "—"}</td>
                        <td className="p-2">{r.data.category || "—"}</td>
                        <td className="p-2">{r.data.brand || "—"}</td>
                        <td className="p-2">
                          {r.errors.length ? (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertCircle className="h-3 w-3" />
                              {r.errors.join(" • ")}
                            </span>
                          ) : (
                            <span className="text-green-600">جاهز</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={commit} disabled={importing || validCount === 0}>
            {importing && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
            استيراد {validCount > 0 ? `(${validCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PlatformProductImport;
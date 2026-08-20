import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Edit,
  Archive,
  ArchiveRestore,
  PlusCircle,
  Search,
  Send,
  Loader2,
  Eye,
  EyeOff,
  Percent,
  Download,
  Upload,
  BarChart3,
  FileDown,
} from "lucide-react";
import { moderationBadgeClass, moderationLabel } from "@/lib/productModeration";
import { buildProductsCsv, parseProductsCsv, PRODUCT_CSV_COLUMNS, type ProductCsvColumn } from "@/lib/productCsv";
import ProductAnalyticsDialog from "@/components/seller/ProductAnalyticsDialog";

interface Row {
  id: string;
  name: string;
  price: number;
  stock_quantity: number | null;
  image_url: string | null;
  moderation_status: string | null;
  moderation_reason: string | null;
  is_active: boolean | null;
  created_at: string | null;
  sku: string | null;
  barcode: string | null;
  brand_id: string | null;
}

interface Brand {
  id: string;
  name: string;
}

const STATUS_FILTERS = ["all", "draft", "pending", "approved", "rejected", "hidden", "archived"];
const STOCK_FILTERS = [
  { value: "all", label: "كل حالات المخزون" },
  { value: "out", label: "نفد المخزون" },
  { value: "low", label: "منخفض (≤5)" },
];
const SORT_OPTIONS = [
  { value: "newest", label: "الأحدث" },
  { value: "price_desc", label: "الأعلى سعراً" },
  { value: "price_asc", label: "الأقل سعراً" },
  { value: "stock_desc", label: "الأكثر مخزوناً" },
];

const CSV_TEMPLATE_ROW: Record<ProductCsvColumn, string> = {
  name: "قميص قطني رجالي",
  name_en: "Cotton Shirt",
  sku: "SKU-001",
  barcode: "6291000000001",
  price: "50000",
  discount_price: "45000",
  stock_quantity: "20",
  category_id: "",
  brand_id: "",
  shipping_cost: "5000",
  weight: "0.3",
  country_of_origin: "سوريا",
  warranty: "لا يوجد",
  short_description: "وصف مختصر للمنتج",
  description: "وصف تفصيلي للمنتج",
  tags: "قطن|رجالي|صيفي",
  seo_title: "",
  seo_description: "",
};

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const SellerProducts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pricePct, setPricePct] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const [busy, setBusy] = useState(false);
  const [analyticsProduct, setAnalyticsProduct] = useState<{ id: string; name: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ReturnType<typeof parseProductsCsv>["rows"]>([]);
  const [parseErrors, setParseErrors] = useState<ReturnType<typeof parseProductsCsv>["errors"]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [productsRes, brandsRes] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,price,stock_quantity,image_url,moderation_status,moderation_reason,is_active,created_at,sku,barcode,brand_id")
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("brands").select("id,name").order("name"),
    ]);
    if (productsRes.error) toast({ title: "تعذّر تحميل المنتجات", description: productsRes.error.message, variant: "destructive" });
    setRows((productsRes.data as Row[]) ?? []);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const filtered = useMemo(() => {
    let list = rows;
    if (status !== "all") list = list.filter((r) => r.moderation_status === status);
    if (brandFilter !== "all") list = list.filter((r) => r.brand_id === brandFilter);
    if (stockFilter === "out") list = list.filter((r) => (r.stock_quantity ?? 0) <= 0);
    if (stockFilter === "low") list = list.filter((r) => (r.stock_quantity ?? 0) > 0 && (r.stock_quantity ?? 0) <= 5);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          (r.sku ?? "").toLowerCase().includes(s) ||
          (r.barcode ?? "").toLowerCase().includes(s)
      );
    }
    list = [...list];
    switch (sortBy) {
      case "price_desc":
        list.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "price_asc":
        list.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "stock_desc":
        list.sort((a, b) => (b.stock_quantity ?? 0) - (a.stock_quantity ?? 0));
        break;
      default:
        list.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
    }
    return list;
  }, [rows, q, status, brandFilter, stockFilter, sortBy]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.id));
        return next;
      }
      return new Set([...prev, ...filtered.map((r) => r.id)]);
    });

  const run = async (fn: () => any, msg: string) => {
    const { error } = await fn();
    if (error) {
      toast({ title: "تعذّر تنفيذ العملية", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: msg });
    load();
  };

  const bulkUpdate = async (payload: { price_pct?: number; stock?: number; is_active?: boolean }) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("seller_bulk_update_products", {
      _ids: ids,
      _price_pct: payload.price_pct ?? null,
      _stock: payload.stock ?? null,
      _is_active: payload.is_active ?? null,
    });
    setBusy(false);
    if (error) {
      const map: Record<string, string> = {
        invalid_price_percent: "نسبة التغيير غير مقبولة (من -90% إلى +500%).",
        invalid_stock: "الكمية غير صحيحة.",
        too_many_products: "الحد الأقصى 200 منتج في العملية الواحدة.",
        nothing_to_update: "لم تحدّد أي تغيير.",
      };
      const key = Object.keys(map).find((k) => error.message.includes(k));
      toast({ title: "تعذّر التعديل الجمعي", description: key ? map[key] : error.message, variant: "destructive" });
      return;
    }
    toast({ title: `تم تحديث ${Number(data ?? 0)} منتج` });
    setPricePct("");
    setBulkStock("");
    load();
  };

  const bulkSubmitForReview = async () => {
    const ids = [...selected].filter((id) => {
      const r = rows.find((x) => x.id === id);
      return r?.moderation_status === "draft" || r?.moderation_status === "rejected";
    });
    if (!ids.length) {
      toast({ title: "لا يوجد منتجات قابلة للإرسال", description: "الإرسال متاح للمسودات والمنتجات المرفوضة فقط." });
      return;
    }
    setBusy(true);
    let ok = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc("vendor_submit_product_for_review", { _product_id: id });
      if (!error) ok += 1;
    }
    setBusy(false);
    toast({ title: `تم إرسال ${ok} منتج للمراجعة` });
    load();
  };

  const exportCsv = async () => {
    if (filtered.length === 0) {
      toast({ title: "لا يوجد منتجات للتصدير" });
      return;
    }
    setExporting(true);
    const ids = filtered.map((r) => r.id);
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_CSV_COLUMNS.join(","))
      .in("id", ids);
    setExporting(false);
    if (error) {
      toast({ title: "تعذّر تصدير المنتجات", description: error.message, variant: "destructive" });
      return;
    }
    const csv = buildProductsCsv((data as any[]) ?? []);
    downloadBlob(csv, `products-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
    toast({ title: `تم تصدير ${(data ?? []).length} منتج` });
  };

  const downloadTemplate = () => {
    const csv = buildProductsCsv([CSV_TEMPLATE_ROW]);
    downloadBlob(csv, "products-template.csv", "text/csv;charset=utf-8;");
  };

  const onFileSelected = async (file: File) => {
    const text = await file.text();
    setImportText(text);
    const { rows: parsed, errors } = parseProductsCsv(text);
    setParsedRows(parsed);
    setParseErrors(errors);
  };

  const resetImport = () => {
    setImportText(null);
    setParsedRows([]);
    setParseErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runImport = async () => {
    if (!user || parsedRows.length === 0) return;
    setImporting(true);
    let ok = 0;
    let failed = 0;
    for (const { data } of parsedRows) {
      const payload: Record<string, unknown> = {
        vendor_id: user.id,
        moderation_status: "draft",
        is_active: false,
        name: data.name,
        name_en: data.name_en || null,
        sku: data.sku || null,
        barcode: data.barcode || null,
        price: Number(data.price),
        discount_price: data.discount_price ? Number(data.discount_price) : null,
        stock_quantity: data.stock_quantity ? Math.floor(Number(data.stock_quantity)) : 0,
        category_id: data.category_id || null,
        brand_id: data.brand_id || null,
        shipping_cost: data.shipping_cost ? Number(data.shipping_cost) : null,
        weight: data.weight ? Number(data.weight) : null,
        country_of_origin: data.country_of_origin || null,
        warranty: data.warranty || null,
        short_description: data.short_description || null,
        description: data.description || null,
        tags: data.tags ? data.tags.split("|").map((t) => t.trim()).filter(Boolean) : null,
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
      };
      const { error } = await supabase.from("products").insert(payload as any);
      if (error) failed += 1;
      else ok += 1;
    }
    setImporting(false);
    toast({ title: `تم الاستيراد: ${ok} نجاح، ${failed} فشل` });
    if (ok > 0) {
      setImportOpen(false);
      resetImport();
      load();
    }
  };

  return (
    <SellerLayout
      title="المنتجات"
      description="إدارة منتجاتك، التعديل الجمعي، وأكواد SKU والباركود"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={exporting}>
            {exporting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Download className="me-2 h-4 w-4" />}
            تصدير CSV
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="me-2 h-4 w-4" /> استيراد CSV
          </Button>
          <Button asChild>
            <Link to="/dashboard/add-product"><PlusCircle className="me-2 h-4 w-4" /> إضافة منتج</Link>
          </Button>
        </div>
      }
    >
      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-3 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو SKU أو الباركود" className="pe-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>{s === "all" ? "كل الحالات" : moderationLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="العلامة التجارية" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العلامات التجارية</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STOCK_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={toggleAllVisible} disabled={filtered.length === 0}>
            {allVisibleSelected ? "إلغاء تحديد الظاهر" : "تحديد كل الظاهر"}
          </Button>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <Card className="mb-4 border-primary/40">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Badge className="bg-primary text-primary-foreground">محدّد: {selected.size}</Badge>

            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                className="w-28"
                placeholder="±% السعر"
                aria-label="نسبة تغيير السعر"
                value={pricePct}
                onChange={(e) => setPricePct(e.target.value)}
              />
              <Button
                size="sm"
                disabled={busy || pricePct.trim() === "" || Number.isNaN(Number(pricePct))}
                onClick={() => bulkUpdate({ price_pct: Number(pricePct) })}
              >
                تطبيق على الأسعار
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                className="w-28"
                placeholder="كمية جديدة"
                aria-label="كمية المخزون الجديدة"
                value={bulkStock}
                onChange={(e) => setBulkStock(e.target.value)}
              />
              <Button
                size="sm"
                disabled={busy || bulkStock.trim() === "" || Number.isNaN(Number(bulkStock))}
                onClick={() => bulkUpdate({ stock: Math.max(0, Math.floor(Number(bulkStock))) })}
              >
                تعيين المخزون
              </Button>
            </div>

            <Button size="sm" variant="outline" disabled={busy} onClick={() => bulkUpdate({ is_active: true })}>
              <Eye className="me-1 h-4 w-4" /> إظهار
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => bulkUpdate({ is_active: false })}>
              <EyeOff className="me-1 h-4 w-4" /> إخفاء
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={bulkSubmitForReview}>
              <Send className="me-1 h-4 w-4" /> إرسال للمراجعة
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>إلغاء التحديد</Button>
            {busy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">لا توجد منتجات مطابقة.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Card key={p.id} className={selected.has(p.id) ? "border-primary/60" : undefined}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggleOne(p.id)}
                  aria-label={`تحديد ${p.name}`}
                />
                <img
                  src={p.image_url || "/placeholder.svg"}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {Number(p.price).toLocaleString("ar-SY")} ل.س · المخزون: {p.stock_quantity ?? 0}
                    {p.is_active === false && " · مخفي"}
                  </p>
                  {(p.sku || p.barcode) && (
                    <p className="text-xs text-muted-foreground">
                      {p.sku && <span>SKU: {p.sku}</span>}
                      {p.sku && p.barcode && " · "}
                      {p.barcode && <span>باركود: {p.barcode}</span>}
                    </p>
                  )}
                  {p.moderation_status === "rejected" && p.moderation_reason && (
                    <p className="mt-1 text-xs text-destructive">سبب الرفض: {p.moderation_reason}</p>
                  )}
                </div>
                <Badge variant="secondary" className={moderationBadgeClass(p.moderation_status)}>
                  {moderationLabel(p.moderation_status)}
                </Badge>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAnalyticsProduct({ id: p.id, name: p.name })}>
                    <BarChart3 className="me-1 h-4 w-4" /> الإحصائيات
                  </Button>
                  {(p.moderation_status === "draft" || p.moderation_status === "rejected") && (
                    <Button
                      size="sm"
                      onClick={() => run(() => supabase.rpc("vendor_submit_product_for_review", { _product_id: p.id }), "تم إرسال المنتج للمراجعة")}
                    >
                      <Send className="me-1 h-4 w-4" /> إرسال للمراجعة
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/dashboard/edit-product/${p.id}`}><Edit className="me-1 h-4 w-4" /> تعديل</Link>
                  </Button>
                  {p.moderation_status === "archived" ? (
                    <Button size="sm" variant="outline" onClick={() => run(() => supabase.rpc("restore_product", { _product_id: p.id }), "تم استعادة المنتج")}>
                      <ArchiveRestore className="me-1 h-4 w-4" /> استعادة
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => run(() => supabase.rpc("delete_or_archive_product", { _product_id: p.id }), "تم تنفيذ العملية")}>
                      <Archive className="me-1 h-4 w-4" /> أرشفة/حذف
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProductAnalyticsDialog
        productId={analyticsProduct?.id ?? null}
        productName={analyticsProduct?.name}
        onOpenChange={(open) => { if (!open) setAnalyticsProduct(null); }}
      />

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) resetImport();
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>استيراد منتجات من CSV</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <FileDown className="me-2 h-4 w-4" /> تحميل نموذج CSV
            </Button>

            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelected(file);
              }}
            />

            {parseErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <p className="mb-1 text-sm font-semibold text-destructive">أخطاء في الملف:</p>
                <ul className="list-inside list-disc space-y-1 text-xs text-destructive">
                  {parseErrors.map((e, i) => (
                    <li key={i}>{e.line > 0 ? `السطر ${e.line}: ` : ""}{e.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsedRows.length > 0 && (
              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  معاينة: {parsedRows.length} منتج صالح للاستيراد{importText ? "" : ""}
                </p>
                <div className="max-h-64 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الاسم</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>السعر</TableHead>
                        <TableHead>المخزون</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.slice(0, 50).map((r) => (
                        <TableRow key={r.line}>
                          <TableCell className="max-w-[220px] truncate">{r.data.name}</TableCell>
                          <TableCell>{r.data.sku || "-"}</TableCell>
                          <TableCell>{r.data.price}</TableCell>
                          <TableCell>{r.data.stock_quantity || 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setImportOpen(false); resetImport(); }}>إلغاء</Button>
            <Button onClick={runImport} disabled={importing || parsedRows.length === 0}>
              {importing ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Upload className="me-2 h-4 w-4" />}
              استيراد {parsedRows.length > 0 ? `(${parsedRows.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SellerLayout>
  );
};

export default SellerProducts;

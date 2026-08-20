import { useEffect, useMemo, useState } from "react";
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
import { Edit, Archive, ArchiveRestore, PlusCircle, Search, Send, Loader2, Eye, EyeOff, Percent } from "lucide-react";
import { moderationBadgeClass, moderationLabel } from "@/lib/productModeration";

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
}

const STATUS_FILTERS = ["all", "draft", "pending", "approved", "rejected", "hidden", "archived"];

const SellerProducts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pricePct, setPricePct] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,price,stock_quantity,image_url,moderation_status,moderation_reason,is_active,created_at,sku,barcode")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast({ title: "تعذّر تحميل المنتجات", description: error.message, variant: "destructive" });
    setRows((data as Row[]) ?? []);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const filtered = useMemo(() => {
    let list = rows;
    if (status !== "all") list = list.filter((r) => r.moderation_status === status);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          (r.sku ?? "").toLowerCase().includes(s) ||
          (r.barcode ?? "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [rows, q, status]);

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

  return (
    <SellerLayout
      title="المنتجات"
      description="إدارة منتجاتك، التعديل الجمعي، وأكواد SKU والباركود"
      actions={
        <Button asChild>
          <Link to="/dashboard/add-product"><PlusCircle className="me-2 h-4 w-4" /> إضافة منتج</Link>
        </Button>
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
    </SellerLayout>
  );
};

export default SellerProducts;

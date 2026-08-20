import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, Search, Check, X, ExternalLink, Sparkles, Flame, ThumbsUp, Eye, EyeOff,
} from "lucide-react";

type Status = "pending" | "approved" | "rejected" | "draft" | "hidden" | "archived";

const ALL = "__all__";
const PAGE_SIZE = 30;

interface ProductRow {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  is_active: boolean | null;
  stock_quantity: number | null;
  moderation_status: string;
  moderation_reason: string | null;
  created_at: string | null;
  sku: string | null;
  barcode: string | null;
  vendor_id: string;
  brand_id: string | null;
  category_id: string | null;
  is_featured: boolean | null;
  is_trending: boolean | null;
  is_recommended: boolean | null;
  views_count: number | null;
}

interface Option { id: string; label: string }

const STATUS_TABS: { value: Status; label: string }[] = [
  { value: "pending", label: "قيد المراجعة" },
  { value: "approved", label: "معتمدة" },
  { value: "rejected", label: "مرفوضة" },
  { value: "draft", label: "مسودات" },
  { value: "hidden", label: "مخفية" },
  { value: "archived", label: "مؤرشفة" },
];

const SORTS = [
  { value: "newest", label: "الأحدث" },
  { value: "oldest", label: "الأقدم" },
  { value: "price_desc", label: "الأعلى سعراً" },
  { value: "price_asc", label: "الأقل سعراً" },
  { value: "views", label: "الأكثر مشاهدة" },
] as const;

const ProductModeration = () => {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("pending");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [brandId, setBrandId] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("newest");
  const [brands, setBrands] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [vendors, setVendors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<ProductRow | null>(null);
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    void (async () => {
      const [{ data: b }, { data: c }] = await Promise.all([
        supabase.from("brands").select("id, name_ar").order("name_ar"),
        supabase.from("categories").select("id, name_ar").order("name_ar"),
      ]);
      setBrands((b ?? []).map((r) => ({ id: r.id, label: r.name_ar })));
      setCategories((c ?? []).map((r) => ({ id: r.id, label: r.name_ar })));
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("products")
      .select(
        "id, name, price, image_url, is_active, stock_quantity, moderation_status, moderation_reason, created_at, sku, barcode, vendor_id, brand_id, category_id, is_featured, is_trending, is_recommended, views_count",
        { count: "exact" }
      )
      .eq("product_type", "seller")
      .eq("moderation_status", status);

    if (brandId !== ALL) query = query.eq("brand_id", brandId);
    if (categoryId !== ALL) query = query.eq("category_id", categoryId);

    const term = search.trim();
    if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%`);

    if (sort === "newest") query = query.order("created_at", { ascending: false });
    else if (sort === "oldest") query = query.order("created_at", { ascending: true });
    else if (sort === "price_desc") query = query.order("price", { ascending: false });
    else if (sort === "price_asc") query = query.order("price", { ascending: true });
    else query = query.order("views_count", { ascending: false });

    const { data, error, count } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    const list = (data ?? []) as ProductRow[];
    setRows(list);
    setTotal(count ?? list.length);
    setSelected(new Set());

    const ids = [...new Set(list.map((r) => r.vendor_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p.full_name ?? "بائع"; });
      setVendors(map);
    }
    setLoading(false);
  }, [status, search, brandId, categoryId, sort, page, toast]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => { setPage(0); }, [status, search, brandId, categoryId, sort]);

  const moderate = async (product: ProductRow, action: "approve" | "reject", why?: string) => {
    setWorking(true);
    const { error } = await supabase.rpc("admin_moderate_product", {
      _product_id: product.id,
      _action: action,
      _reason: why ?? null,
    });
    setWorking(false);
    if (error) {
      toast({ title: "تعذر تنفيذ الإجراء", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: action === "approve" ? "تم اعتماد المنتج" : "تم رفض المنتج" });
    setRejecting(null);
    setReason("");
    void load();
  };

  const bulkModerate = async (action: "approve" | "reject", why?: string) => {
    const ids = [...selected];
    if (!ids.length) return;
    setWorking(true);
    let ok = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc("admin_moderate_product", {
        _product_id: id,
        _action: action,
        _reason: why ?? null,
      });
      if (!error) ok += 1;
    }
    setWorking(false);
    setBulkRejecting(false);
    setReason("");
    toast({ title: `تم تنفيذ الإجراء على ${ok} من ${ids.length} منتج` });
    void load();
  };

  const setFlags = async (
    product: ProductRow,
    flags: { is_featured?: boolean; is_trending?: boolean; is_recommended?: boolean; is_active?: boolean }
  ) => {
    const { error } = await supabase.rpc("admin_set_product_flags", {
      _product_id: product.id,
      _is_featured: flags.is_featured ?? null,
      _is_trending: flags.is_trending ?? null,
      _is_recommended: flags.is_recommended ?? null,
      _is_active: flags.is_active ?? null,
    });
    if (error) {
      toast({ title: "تعذر تحديث حالة العرض", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === product.id ? { ...r, ...flags } : r)));
  };

  const bulkFlags = async (flags: { is_featured?: boolean; is_trending?: boolean; is_recommended?: boolean; is_active?: boolean }) => {
    const ids = [...selected];
    if (!ids.length) return;
    setWorking(true);
    let ok = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc("admin_set_product_flags", {
        _product_id: id,
        _is_featured: flags.is_featured ?? null,
        _is_trending: flags.is_trending ?? null,
        _is_recommended: flags.is_recommended ?? null,
        _is_active: flags.is_active ?? null,
      });
      if (!error) ok += 1;
    }
    setWorking(false);
    toast({ title: `تم تحديث ${ok} منتج` });
    void load();
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  const pages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <AdminLayout
      title="منتجات البائعين"
      description="مراجعة منتجات البائعين المحليين واعتمادها أو رفضها والتحكم بظهورها على المنصة."
    >
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
            <TabsList className="flex-wrap">
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو SKU أو الباركود..."
              className="pe-9"
            />
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="الفئة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>كل الفئات</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="العلامة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>كل العلامات</SelectItem>
              {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{total}</Badge>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {allSelected ? "إلغاء تحديد الكل" : "تحديد كل الظاهر"}
          </Button>
          {selected.size > 0 && (
            <>
              <Badge className="bg-primary text-primary-foreground">محدّد: {selected.size}</Badge>
              {status !== "approved" && (
                <Button size="sm" disabled={working} onClick={() => bulkModerate("approve")}>
                  <Check className="me-1 h-4 w-4" /> اعتماد المحدد
                </Button>
              )}
              {status !== "rejected" && (
                <Button size="sm" variant="destructive" disabled={working} onClick={() => { setReason(""); setBulkRejecting(true); }}>
                  <X className="me-1 h-4 w-4" /> رفض المحدد
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={working} onClick={() => bulkFlags({ is_featured: true })}>
                <Sparkles className="me-1 h-4 w-4" /> تمييز
              </Button>
              <Button size="sm" variant="outline" disabled={working} onClick={() => bulkFlags({ is_active: false })}>
                <EyeOff className="me-1 h-4 w-4" /> إخفاء
              </Button>
              {working && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">لا توجد منتجات مطابقة</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
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
                  className="h-16 w-16 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Intl.NumberFormat("ar-SY").format(p.price)} ل.س · المخزون {p.stock_quantity ?? 0}
                    {" · "}البائع: {vendors[p.vendor_id] ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.sku && <span>SKU: {p.sku} </span>}
                    {p.barcode && <span>· باركود: {p.barcode} </span>}
                    <span>· مشاهدات: {p.views_count ?? 0}</span>
                  </p>
                  {p.moderation_reason && (
                    <p className="mt-1 text-xs text-destructive">السبب: {p.moderation_reason}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.is_featured && <Badge variant="secondary">مميز</Badge>}
                    {p.is_trending && <Badge variant="secondary">رائج</Badge>}
                    {p.is_recommended && <Badge variant="secondary">موصى به</Badge>}
                    {p.is_active === false && <Badge variant="outline">مخفي</Badge>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={p.is_featured ? "default" : "outline"}
                    onClick={() => setFlags(p, { is_featured: !p.is_featured })}
                    aria-label="تمييز المنتج"
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={p.is_trending ? "default" : "outline"}
                    onClick={() => setFlags(p, { is_trending: !p.is_trending })}
                    aria-label="منتج رائج"
                  >
                    <Flame className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={p.is_recommended ? "default" : "outline"}
                    onClick={() => setFlags(p, { is_recommended: !p.is_recommended })}
                    aria-label="موصى به"
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFlags(p, { is_active: !(p.is_active ?? false) })}
                    aria-label="إظهار أو إخفاء"
                  >
                    {p.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/product/${p.id}`}>
                      <ExternalLink className="me-1 h-4 w-4" /> عرض
                    </Link>
                  </Button>
                  {status !== "approved" && (
                    <Button size="sm" onClick={() => moderate(p, "approve")} disabled={working}>
                      <Check className="me-1 h-4 w-4" /> اعتماد
                    </Button>
                  )}
                  {status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setRejecting(p); setReason(""); }}
                      disabled={working}
                    >
                      <X className="me-1 h-4 w-4" /> رفض
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">صفحة {page + 1} من {pages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
            التالي
          </Button>
        </div>
      )}

      <Dialog open={!!rejecting || bulkRejecting} onOpenChange={(o) => { if (!o) { setRejecting(null); setBulkRejecting(false); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{bulkRejecting ? `رفض ${selected.size} منتج` : "رفض المنتج"}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="سبب الرفض (يظهر للبائع)"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejecting(null); setBulkRejecting(false); }}>إلغاء</Button>
            <Button
              variant="destructive"
              disabled={working || !reason.trim()}
              onClick={() => {
                if (bulkRejecting) void bulkModerate("reject", reason.trim());
                else if (rejecting) void moderate(rejecting, "reject", reason.trim());
              }}
            >
              {working && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default ProductModeration;

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Upload, Edit2, Trash2, Package, Settings2, Search } from "lucide-react";
import PlatformProductForm, { PlatformProduct } from "@/components/admin/PlatformProductForm";
import PlatformProductImport from "@/components/admin/PlatformProductImport";
import CategoriesBrandsManager from "@/components/admin/CategoriesBrandsManager";
import PlatformShamCashSettings from "@/components/admin/PlatformShamCashSettings";
import FeatureFlagsManager from "@/components/admin/FeatureFlagsManager";
import ShamCashMerchantConfig from "@/components/admin/ShamCashMerchantConfig";

const PlatformProducts = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("__all__");
  const [filterBrand, setFilterBrand] = useState<string>("__all__");
  const [filterStatus, setFilterStatus] = useState<string>("__all__");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformProduct | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [cbOpen, setCbOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: c }, { data: b }] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("product_type", "platform")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("id, name, name_ar").order("name_ar"),
      supabase.from("brands").select("id, name, name_ar").order("name_ar"),
    ]);
    setProducts(p || []);
    setCategories(c || []);
    setBrands(b || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search && !`${p.name} ${p.sku || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory !== "__all__" && p.category_id !== filterCategory) return false;
      if (filterBrand !== "__all__" && p.brand_id !== filterBrand) return false;
      if (filterStatus === "active" && !p.is_active) return false;
      if (filterStatus === "inactive" && p.is_active) return false;
      if (filterStatus === "out_of_stock" && (p.stock_quantity ?? 0) > 0) return false;
      return true;
    });
  }, [products, search, filterCategory, filterBrand, filterStatus]);

  const toggleSelect = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const bulk = async (action: "activate" | "deactivate" | "delete") => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);

    if (action === "delete") {
      if (!confirm(`حذف ${ids.length} منتج؟ المنتجات المرتبطة بطلبات ستتم أرشفتها بدلاً من حذفها.`)) return;
      let deleted = 0, archived = 0, failed = 0;
      for (const id of ids) {
        const { data, error } = await supabase.rpc("delete_or_archive_product", { _product_id: id });
        if (error) failed++;
        else if (data === "deleted") deleted++;
        else archived++;
      }
      toast({
        title: "تم",
        description: `حُذف ${deleted}، وأُرشف ${archived}${failed ? `، وفشل ${failed}` : ""}.`,
      });
      setSelected(new Set());
      load();
      return;
    }

    const { error } = await supabase
      .from("products")
      .update({ is_active: action === "activate" })
      .in("id", ids);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else {
      toast({ title: "تم" });
      setSelected(new Set());
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف المنتج؟ إذا كان مرتبطاً بطلبات سابقة فسيتم أرشفته بدلاً من حذفه.")) return;
    const { data, error } = await supabase.rpc("delete_or_archive_product", { _product_id: id });
    if (error) {
      toast({ title: "خطأ", description: "تعذّر تنفيذ العملية.", variant: "destructive" });
      return;
    }
    toast({
      title: data === "deleted" ? "تم الحذف" : "تمت الأرشفة",
      description:
        data === "deleted"
          ? "تم حذف المنتج نهائياً."
          : "لا يمكن حذف هذا المنتج نهائياً لأنه مرتبط بطلبات عملاء موجودة. تمت أرشفته بدلاً من ذلك.",
    });
    load();
  };

  const openEdit = (p: any) => {
    setEditing({
      id: p.id,
      name: p.name,
      sku: p.sku,
      brand_id: p.brand_id,
      category_id: p.category_id,
      description: p.description,
      price: Number(p.price),
      discount_price: p.discount_price != null ? Number(p.discount_price) : null,
      currency: p.currency || "SYP",
      stock_quantity: p.stock_quantity ?? 0,
      sizes: p.sizes || [],
      colors: p.colors || [],
      weight: p.weight != null ? Number(p.weight) : null,
      image_url: p.image_url,
      images: p.images || [],
      is_active: !!p.is_active,
    });
    setFormOpen(true);
  };

  const openNew = () => { setEditing(null); setFormOpen(true); };

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name_ar])), [categories]);
  const brandMap = useMemo(() => new Map(brands.map((b) => [b.id, b.name_ar])), [brands]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Package className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">منتجات المنصة</h1>
              <p className="text-sm text-muted-foreground">إدارة المنتجات المملوكة من قبل المنصة</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCbOpen(true)}>
              <Settings2 className="h-4 w-4 ml-1" /> الفئات والعلامات
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 ml-1" /> استيراد
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 ml-1" /> منتج جديد
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mb-4">
          <FeatureFlagsManager />
          <PlatformShamCashSettings />
        </div>

        <div className="mb-4">
          <ShamCashMerchantConfig />
        </div>

        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">تصفية</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث بالاسم أو SKU" value={search} onChange={(e) => setSearch(e.target.value)} className="pr-8" />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger><SelectValue placeholder="الفئة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل الفئات</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterBrand} onValueChange={setFilterBrand}>
              <SelectTrigger><SelectValue placeholder="العلامة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">كل العلامات</SelectItem>
                {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name_ar}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">الكل</SelectItem>
                <SelectItem value="active">مفعّل</SelectItem>
                <SelectItem value="inactive">غير مفعّل</SelectItem>
                <SelectItem value="out_of_stock">نفد المخزون</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 mb-4 bg-muted p-3 rounded-lg">
            <span className="text-sm">{selected.size} محدد</span>
            <Button size="sm" variant="outline" onClick={() => bulk("activate")}>تفعيل</Button>
            <Button size="sm" variant="outline" onClick={() => bulk("deactivate")}>تعطيل</Button>
            <Button size="sm" variant="destructive" onClick={() => bulk("delete")}>حذف</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>إلغاء التحديد</Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">لا توجد منتجات</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="p-2 text-right">الصورة</th>
                  <th className="p-2 text-right">الاسم</th>
                  <th className="p-2 text-right">SKU</th>
                  <th className="p-2 text-right">الفئة</th>
                  <th className="p-2 text-right">العلامة</th>
                  <th className="p-2 text-right">السعر</th>
                  <th className="p-2 text-right">الكمية</th>
                  <th className="p-2 text-right">الحالة</th>
                  <th className="p-2 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-muted/40">
                    <td className="p-2">
                      <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                    </td>
                    <td className="p-2">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-12 h-12 rounded object-cover" />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded" />
                      )}
                    </td>
                    <td className="p-2 font-medium max-w-xs truncate">{p.name}</td>
                    <td className="p-2 text-muted-foreground">{p.sku || "—"}</td>
                    <td className="p-2">{catMap.get(p.category_id) || "—"}</td>
                    <td className="p-2">{brandMap.get(p.brand_id) || "—"}</td>
                    <td className="p-2">
                      {Number(p.price).toLocaleString()} {p.currency === "SYP" ? "ل.س" : p.currency}
                      {p.discount_price && (
                        <span className="block text-xs text-green-600">
                          خصم: {Number(p.discount_price).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {(p.stock_quantity ?? 0) === 0 ? (
                        <Badge variant="destructive">نفد</Badge>
                      ) : (
                        p.stock_quantity
                      )}
                    </td>
                    <td className="p-2">
                      {p.is_active ? <Badge>مفعّل</Badge> : <Badge variant="secondary">غير مفعّل</Badge>}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <PlatformProductForm
          open={formOpen}
          onOpenChange={setFormOpen}
          product={editing}
          onSaved={load}
          categories={categories}
          brands={brands}
        />
        <PlatformProductImport
          open={importOpen}
          onOpenChange={setImportOpen}
          categories={categories}
          brands={brands}
          onImported={load}
        />
        <CategoriesBrandsManager open={cbOpen} onOpenChange={setCbOpen} onChanged={load} />
      </main>
      <Footer />
    </div>
  );
};

export default PlatformProducts;
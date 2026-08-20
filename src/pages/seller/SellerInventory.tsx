import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Loader2, Save, Search, Barcode } from "lucide-react";
import { Link } from "react-router-dom";
import { LOW_STOCK_THRESHOLD } from "@/lib/productModeration";

interface Row {
  id: string;
  name: string;
  image_url: string | null;
  stock_quantity: number | null;
  sku: string | null;
  barcode: string | null;
}

const SellerInventory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [codeDrafts, setCodeDrafts] = useState<Record<string, { sku: string; barcode: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "low" | "out">("all");
  const [q, setQ] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,image_url,stock_quantity,sku,barcode")
      .eq("vendor_id", user.id)
      .order("stock_quantity", { ascending: true });
    if (error) toast({ title: "تعذّر تحميل المخزون", description: error.message, variant: "destructive" });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab === "low") list = list.filter((r) => (r.stock_quantity ?? 0) > 0 && (r.stock_quantity ?? 0) <= LOW_STOCK_THRESHOLD);
    if (tab === "out") list = list.filter((r) => (r.stock_quantity ?? 0) === 0);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(
        (r) => r.name.toLowerCase().includes(s) || (r.sku ?? "").toLowerCase().includes(s) || (r.barcode ?? "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [rows, tab, q]);

  const counts = useMemo(() => ({
    all: rows.length,
    low: rows.filter((r) => (r.stock_quantity ?? 0) > 0 && (r.stock_quantity ?? 0) <= LOW_STOCK_THRESHOLD).length,
    out: rows.filter((r) => (r.stock_quantity ?? 0) === 0).length,
  }), [rows]);

  const save = async (row: Row) => {
    const raw = drafts[row.id];
    const next = Math.max(0, Math.floor(Number(raw)));
    if (raw === undefined || Number.isNaN(next)) return;
    setSaving(row.id);
    const { error } = await supabase.from("products").update({ stock_quantity: next }).eq("id", row.id);
    setSaving(null);
    if (error) {
      toast({ title: "تعذّر تحديث المخزون", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, stock_quantity: next } : r)));
    setDrafts((d) => { const c = { ...d }; delete c[row.id]; return c; });
    toast({ title: next === 0 ? "تم التحديث — المنتج الآن نفذت كميته" : "تم تحديث المخزون" });
  };

  const saveCodes = async (row: Row) => {
    const draft = codeDrafts[row.id];
    if (!draft) return;
    const sku = draft.sku.trim().slice(0, 64) || null;
    const barcode = draft.barcode.trim().slice(0, 64) || null;
    setSaving(`codes-${row.id}`);
    const { error } = await supabase.from("products").update({ sku, barcode }).eq("id", row.id);
    setSaving(null);
    if (error) {
      toast({ title: "تعذّر حفظ الأكواد", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, sku, barcode } : r)));
    setCodeDrafts((d) => { const c = { ...d }; delete c[row.id]; return c; });
    toast({ title: "تم حفظ SKU والباركود" });
  };

  return (
    <SellerLayout title="المخزون" description="حدّث الكميات وأكواد SKU والباركود وتابع تنبيهات المخزون المنخفض">
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">الكل ({counts.all})</TabsTrigger>
              <TabsTrigger value="low">منخفض ({counts.low})</TabsTrigger>
              <TabsTrigger value="out">نفذت ({counts.out})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو SKU أو الباركود" className="pe-9" />
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/seller/stock-log"><History className="me-2 h-4 w-4" /> سجل الحركات</Link>
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">لا توجد منتجات في هذه القائمة.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const stock = r.stock_quantity ?? 0;
            const codes = codeDrafts[r.id] ?? { sku: r.sku ?? "", barcode: r.barcode ?? "" };
            const codesDirty = codes.sku !== (r.sku ?? "") || codes.barcode !== (r.barcode ?? "");
            return (
              <Card key={r.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <img src={r.image_url || "/placeholder.svg"} alt={r.name} loading="lazy" decoding="async" className="h-12 w-12 rounded-md object-cover" />
                    <p className="min-w-0 flex-1 truncate font-medium">{r.name}</p>
                    <Badge variant={stock === 0 ? "destructive" : stock <= LOW_STOCK_THRESHOLD ? "secondary" : "outline"}>
                      {stock === 0 ? "نفذت الكمية" : stock <= LOW_STOCK_THRESHOLD ? `مخزون منخفض (${stock})` : `متوفر (${stock})`}
                    </Badge>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="w-24"
                      aria-label={`الكمية الجديدة لـ ${r.name}`}
                      value={drafts[r.id] ?? String(stock)}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                    />
                    <Button size="sm" disabled={drafts[r.id] === undefined || saving === r.id} onClick={() => save(r)}>
                      {saving === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="me-1 h-4 w-4" /> حفظ</>}
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <Barcode className="h-4 w-4 text-muted-foreground" />
                    <Input
                      className="w-40"
                      placeholder="SKU"
                      maxLength={64}
                      aria-label={`SKU لـ ${r.name}`}
                      value={codes.sku}
                      onChange={(e) => setCodeDrafts((d) => ({ ...d, [r.id]: { ...codes, sku: e.target.value } }))}
                    />
                    <Input
                      className="w-48"
                      placeholder="الباركود (EAN / UPC)"
                      maxLength={64}
                      aria-label={`الباركود لـ ${r.name}`}
                      value={codes.barcode}
                      onChange={(e) => setCodeDrafts((d) => ({ ...d, [r.id]: { ...codes, barcode: e.target.value } }))}
                    />
                    <Button size="sm" variant="outline" disabled={!codesDirty || saving === `codes-${r.id}`} onClick={() => saveCodes(r)}>
                      {saving === `codes-${r.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ الأكواد"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </SellerLayout>
  );
};

export default SellerInventory;

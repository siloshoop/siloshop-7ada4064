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
import { Loader2, Save, Search } from "lucide-react";
import { LOW_STOCK_THRESHOLD } from "@/lib/productModeration";

interface Row {
  id: string;
  name: string;
  image_url: string | null;
  stock_quantity: number | null;
}

const SellerInventory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "low" | "out">("all");
  const [q, setQ] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,image_url,stock_quantity")
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
    if (q.trim()) list = list.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
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

  return (
    <SellerLayout title="المخزون" description="حدّث الكميات وتابع تنبيهات المخزون المنخفض">
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
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن منتج" className="pe-9" />
          </div>
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
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
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

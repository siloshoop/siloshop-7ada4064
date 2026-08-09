import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownRight, ArrowUpRight, RefreshCw, Search } from "lucide-react";
import { stockReasonLabel, stockReasonVariant } from "@/lib/stockMovements";

interface Movement {
  id: string;
  product_id: string;
  quantity_before: number | null;
  quantity_after: number | null;
  delta: number;
  reason: string;
  note: string | null;
  created_at: string;
  products?: { name: string; image_url: string | null } | null;
}

const PAGE_SIZE = 50;

const SellerStockLog = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "in" | "out">("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("stock_movements")
      .select("id,product_id,quantity_before,quantity_after,delta,reason,note,created_at,products(name,image_url)")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (error) toast({ title: "تعذّر تحميل سجل الحركات", description: error.message, variant: "destructive" });
    setRows((data as unknown as Movement[]) ?? []);
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("stock-movements-seller")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stock_movements", filter: `vendor_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab === "in") list = list.filter((r) => r.delta > 0);
    if (tab === "out") list = list.filter((r) => r.delta < 0);
    const term = q.trim().toLowerCase();
    if (term) list = list.filter((r) => (r.products?.name ?? "").toLowerCase().includes(term));
    return list;
  }, [rows, tab, q]);

  return (
    <SellerLayout title="سجل حركات المخزون" description="كل تغيير في كميات منتجاتك مع السبب والوقت">
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">الكل</TabsTrigger>
              <TabsTrigger value="in">إضافة</TabsTrigger>
              <TabsTrigger value="out">خصم</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المنتج" className="pe-9" />
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`me-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> تحديث
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">لا توجد حركات مخزون بعد.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => {
            const positive = m.delta > 0;
            return (
              <Card key={m.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <img
                    src={m.products?.image_url || "/placeholder.svg"}
                    alt={m.products?.name || "منتج"}
                    loading="lazy"
                    decoding="async"
                    className="h-12 w-12 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.products?.name || "منتج محذوف"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("ar-SY")}
                      {m.note ? ` — ${m.note}` : ""}
                    </p>
                  </div>
                  <Badge variant={stockReasonVariant(m.reason)}>{stockReasonLabel(m.reason)}</Badge>
                  <div className={`flex items-center gap-1 font-semibold tabular-nums ${positive ? "text-primary" : "text-destructive"}`}>
                    {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {positive ? `+${m.delta}` : m.delta}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {m.quantity_before ?? 0} ← {m.quantity_after ?? 0}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </SellerLayout>
  );
};

export default SellerStockLog;

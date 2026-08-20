import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, PackageX, AlertTriangle } from "lucide-react";

interface InventoryRow {
  id: string;
  name: string;
  vendor_id: string;
  vendor_name: string | null;
  stock_quantity: number;
  price: number;
  is_active: boolean;
  moderation_status: string;
  image_url: string | null;
  updated_at: string;
}

const AdminInventory = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(5);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_inventory_overview", {
      _threshold: threshold,
      _limit: 300,
    });
    if (error) {
      toast({ title: "تعذر تحميل المخزون", description: error.message, variant: "destructive" });
    }
    setRows(((data ?? []) as InventoryRow[]));
    setLoading(false);
  }, [threshold, toast]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => ({
    out: rows.filter((r) => r.stock_quantity <= 0).length,
    low: rows.filter((r) => r.stock_quantity > 0).length,
    published: rows.filter((r) => r.is_active).length,
  }), [rows]);

  return (
    <AdminLayout
      title="المخزون والتنبيهات"
      description="المنتجات التي نفدت كميتها أو أصبحت منخفضة في كل المتاجر"
      actions={
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="me-2 h-4 w-4" /> تحديث
        </Button>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: "نفدت الكمية", value: stats.out },
          { label: "مخزون منخفض", value: stats.low },
          { label: "منشورة حالياً", value: stats.published },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <Label htmlFor="threshold">حد التنبيه (قطعة أو أقل)</Label>
            <Input
              id="threshold"
              type="number"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد منتجات ضمن حد التنبيه</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className={r.stock_quantity <= 0 ? "border-destructive/40" : undefined}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                {r.image_url ? (
                  <img src={r.image_url} alt={r.name} loading="lazy" className="h-14 w-14 rounded-md object-cover" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <PackageX className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{r.name}</span>
                    {r.stock_quantity <= 0 ? (
                      <Badge variant="destructive">نفدت الكمية</Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> {r.stock_quantity} قطعة
                      </Badge>
                    )}
                    {!r.is_active && <Badge variant="outline">غير منشور</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.vendor_name ?? "بائع"} — {r.price.toLocaleString("ar")} ل.س — آخر تحديث {new Date(r.updated_at).toLocaleDateString("ar")}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/product/${r.id}`}>عرض المنتج</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminInventory;

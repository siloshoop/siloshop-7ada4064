import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, Check, X, ExternalLink } from "lucide-react";

type Status = "pending" | "approved" | "rejected";

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
}

const STATUS_TABS: { value: Status; label: string }[] = [
  { value: "pending", label: "قيد المراجعة" },
  { value: "approved", label: "معتمدة" },
  { value: "rejected", label: "مرفوضة" },
];

const ProductModeration = () => {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("pending");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<ProductRow | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("products")
      .select("id, name, price, image_url, is_active, stock_quantity, moderation_status, moderation_reason, created_at")
      .eq("product_type", "seller")
      .eq("moderation_status", status)
      .order("created_at", { ascending: false })
      .limit(150);
    if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
    const { data, error } = await query;
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setRows((data ?? []) as ProductRow[]);
    setLoading(false);
  }, [status, search, toast]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

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

  return (
    <AdminLayout
      title="منتجات البائعين"
      description="مراجعة منتجات البائعين المحليين واعتمادها أو رفضها قبل النشر."
    >
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
            <TabsList>
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم المنتج..."
              className="pe-9"
            />
          </div>
          <Badge variant="secondary">{rows.length}</Badge>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">لا توجد منتجات</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <img
                  src={p.image_url || "/placeholder.svg"}
                  alt={p.name}
                  loading="lazy"
                  className="h-16 w-16 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Intl.NumberFormat("ar-SY").format(p.price)} ل.س · المخزون {p.stock_quantity ?? 0}
                  </p>
                  {p.moderation_reason && (
                    <p className="mt-1 text-xs text-destructive">السبب: {p.moderation_reason}</p>
                  )}
                </div>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رفض المنتج</DialogTitle>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="سبب الرفض (يظهر للبائع)"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              disabled={working || !reason.trim()}
              onClick={() => rejecting && moderate(rejecting, "reject", reason.trim())}
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
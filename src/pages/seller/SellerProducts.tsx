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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Archive, ArchiveRestore, PlusCircle, Search, Send } from "lucide-react";
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
}

const STATUS_FILTERS = ["all", "draft", "pending", "approved", "rejected", "hidden", "archived"];

const SellerProducts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,price,stock_quantity,image_url,moderation_status,moderation_reason,is_active,created_at")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast({ title: "تعذّر تحميل المنتجات", description: error.message, variant: "destructive" });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const filtered = useMemo(() => {
    let list = rows;
    if (status !== "all") list = list.filter((r) => r.moderation_status === status);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(s));
    }
    return list;
  }, [rows, q, status]);

  const run = async (fn: () => any, msg: string) => {
    const { error } = await fn();
    if (error) {
      toast({ title: "تعذّر تنفيذ العملية", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: msg });
    load();
  };

  return (
    <SellerLayout
      title="المنتجات"
      description="جميع منتجاتك وحالة مراجعتها من الإدارة"
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
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في منتجاتك" className="pe-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>{s === "all" ? "كل الحالات" : moderationLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">لا توجد منتجات مطابقة.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
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
                  </p>
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

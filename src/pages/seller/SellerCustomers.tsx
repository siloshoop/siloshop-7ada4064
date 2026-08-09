import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ShieldCheck } from "lucide-react";

interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  customer_name: string | null;
  city: string | null;
}

interface CustomerRow {
  name: string;
  city: string;
  orders: number;
  delivered: number;
  total: number;
  last: string;
}

const SellerCustomers = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_vendor_orders");
      if (error) toast({ title: "تعذّر تحميل العملاء", description: error.message, variant: "destructive" });
      setOrders((data as OrderRow[]) ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customers = useMemo(() => {
    const map = new Map<string, CustomerRow>();
    for (const o of orders) {
      const name = o.customer_name?.trim() || "عميل";
      const key = `${name}|${o.city ?? ""}`;
      const prev = map.get(key) ?? { name, city: o.city ?? "-", orders: 0, delivered: 0, total: 0, last: o.created_at };
      prev.orders += 1;
      if (o.status === "delivered") {
        prev.delivered += 1;
        prev.total += Number(o.total_amount || 0);
      }
      if (new Date(o.created_at) > new Date(prev.last)) prev.last = o.created_at;
      map.set(key, prev);
    }
    let list = [...map.values()].sort((a, b) => b.orders - a.orders);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(s) || c.city.toLowerCase().includes(s));
    }
    return list;
  }, [orders, q]);

  return (
    <SellerLayout title="العملاء" description="ملخص عملائك المرتبطين بطلباتك فقط">
      <Card className="mb-4 border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            حفاظاً على خصوصية العملاء، تظهر هنا بيانات محدودة فقط. يظهر رقم الهاتف وعنوان التسليم داخل تفاصيل الطلب
            عند الحاجة لتنفيذ الشحن فقط.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو المحافظة" className="pe-9" />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : customers.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">لا يوجد عملاء بعد.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">المحافظة</TableHead>
                  <TableHead className="text-right">الطلبات</TableHead>
                  <TableHead className="text-right">المسلّمة</TableHead>
                  <TableHead className="text-right">إجمالي المسلّم</TableHead>
                  <TableHead className="text-right">آخر طلب</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={`${c.name}-${c.city}`}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.city}</TableCell>
                    <TableCell>{c.orders}</TableCell>
                    <TableCell><Badge variant="secondary">{c.delivered}</Badge></TableCell>
                    <TableCell>{c.total.toLocaleString("ar-SY")} ل.س</TableCell>
                    <TableCell>{new Date(c.last).toLocaleDateString("ar-SY")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </SellerLayout>
  );
};

export default SellerCustomers;

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RotateCcw, Search, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { RETURN_STATUS } from "@/lib/returnStatus";
import ReturnTimeline from "@/components/returns/ReturnTimeline";
import ReturnDetailDialog from "@/components/returns/ReturnDetailDialog";

interface ReturnListRow {
  id: string;
  status: string;
  return_number: string | null;
  order_id: string;
  order_number: string | null;
  reason_label: string | null;
  description: string | null;
  unread_count: number;
  items_count: number;
  created_at: string;
}

const MyReturns = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReturnListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.rpc("list_returns", {
      _scope: "customer",
      _status: null,
      _search: search.trim() || null,
      _limit: 50,
      _offset: 0,
    });
    const payload = data as unknown as { rows?: ReturnListRow[] } | null;
    setRows(payload?.rows ?? []);
    setLoading(false);
  }, [user, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`returns-buyer-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "returns", filter: `customer_id=eq.${user.id}` },
        () => void load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  if (authLoading || (loading && rows.length === 0)) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-6 sm:py-8">
        <div className="mb-4 flex items-center gap-2">
          <RotateCcw className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold sm:text-3xl">طلبات الإرجاع</h1>
        </div>

        <div className="relative mb-4 max-w-md">
          <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم الإرجاع أو رقم الطلب..."
            className="pe-9"
          />
        </div>

        {rows.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <p className="text-muted-foreground">لا توجد طلبات إرجاع</p>
              <Button onClick={() => navigate("/orders")}>الذهاب إلى طلباتي</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => {
              const s = RETURN_STATUS[r.status] ?? RETURN_STATUS.pending_review;
              return (
                <Card key={r.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex flex-col gap-2 text-base sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        إرجاع {r.return_number ?? r.id.slice(0, 8)}
                        {r.order_number && (
                          <span className="text-sm font-normal text-muted-foreground"> — الطلب {r.order_number}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        {r.unread_count > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <MessageCircle className="h-3 w-3" /> {r.unread_count}
                          </Badge>
                        )}
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <ReturnTimeline status={r.status} className="pb-1" />
                    <p className="text-muted-foreground">{s.description}</p>
                    <p>
                      <span className="text-muted-foreground">السبب: </span>
                      <span className="font-medium">{r.reason_label}</span>
                      <span className="text-muted-foreground"> · {r.items_count} منتج</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "dd MMMM yyyy - HH:mm", { locale: ar })}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" onClick={() => setOpenId(r.id)}>
                        التفاصيل والمحادثة
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/orders/${r.order_id}`)}>
                        عرض الطلب
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <ReturnDetailDialog
        returnId={openId}
        open={!!openId}
        onOpenChange={(o) => !o && setOpenId(null)}
        onChanged={load}
      />
      <Footer />
    </div>
  );
};

export default MyReturns;

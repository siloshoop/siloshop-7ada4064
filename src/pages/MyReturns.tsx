import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Image as ImageIcon, Video as VideoIcon, Truck, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { RETURN_STATUS, RETURN_REASONS } from "@/lib/returnStatus";
import ReturnTimeline from "@/components/returns/ReturnTimeline";
import ReturnHistory from "@/components/returns/ReturnHistory";
import { useToast } from "@/hooks/use-toast";

interface ReturnRow {
  id: string;
  order_id: string;
  reason: string;
  notes: string | null;
  images: string[];
  video_url: string | null;
  status: string;
  review_note: string | null;
  rejection_reason: string | null;
  return_instructions: string | null;
  return_address: string | null;
  created_at: string;
  updated_at: string;
}

const reasonLabel = (v: string) => RETURN_REASONS.find((r) => r.value === v)?.label || v;

const MediaThumb = ({ path }: { path: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.storage.from("returns-media").createSignedUrl(path, 3600);
      if (alive) setUrl(data?.signedUrl ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) return <div className="w-16 h-16 bg-muted animate-pulse rounded" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="" className="w-16 h-16 rounded object-cover" />
    </a>
  );
};

const MyReturns = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [shipping, setShipping] = useState<string | null>(null);

  const markShipped = async (id: string) => {
    setShipping(id);
    const { error } = await supabase.rpc("customer_ship_return", {
      _return_id: id,
      _note: null,
    });
    setShipping(null);
    if (error) {
      toast({ title: "تعذر تحديث الطلب", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إبلاغ البائع بإرسال المنتج" });
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("returns")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });
      setReturns((data as ReturnRow[] | null) || []);
      setLoading(false);
    };
    void load();
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
  }, [user]);

  const grouped = useMemo(() => returns, [returns]);

  if (authLoading || loading) {
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
        <div className="mb-6 flex items-center gap-2">
          <RotateCcw className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold sm:text-3xl">طلبات الإرجاع</h1>
        </div>
        {grouped.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <p className="text-muted-foreground">لا توجد طلبات إرجاع</p>
              <Button onClick={() => navigate("/orders")}>الذهاب إلى طلباتي</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {grouped.map((r) => {
              const s = RETURN_STATUS[r.status] || RETURN_STATUS.pending;
              return (
                <Card key={r.id}>
                  <CardHeader>
                    <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-base">
                      <span>إرجاع #{r.id.slice(0, 8)}</span>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <ReturnTimeline status={r.status} className="pb-2" />
                    <p className="text-muted-foreground">{s.description}</p>
                    <p>
                      <span className="text-muted-foreground">السبب: </span>
                      <span className="font-medium">{reasonLabel(r.reason)}</span>
                    </p>
                    {r.notes && <p className="bg-muted/40 rounded p-2">{r.notes}</p>}
                    {r.review_note && (
                      <p className="bg-primary/5 border border-primary/20 rounded p-2">
                        <span className="font-semibold">رد البائع: </span>
                        {r.review_note}
                      </p>
                    )}
                    {r.status === "rejected" && r.rejection_reason && (
                      <p className="rounded border border-destructive/30 bg-destructive/5 p-2">
                        <span className="font-semibold">سبب الرفض: </span>
                        {r.rejection_reason}
                      </p>
                    )}
                    {r.return_instructions && (
                      <div className="rounded border border-primary/20 bg-primary/5 p-2 space-y-1">
                        <p>
                          <span className="font-semibold">تعليمات الإرجاع: </span>
                          {r.return_instructions}
                        </p>
                        {r.return_address && (
                          <p className="flex items-start gap-1">
                            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <span>{r.return_address}</span>
                          </p>
                        )}
                      </div>
                    )}
                    {r.images.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        {r.images.map((p) => (
                          <MediaThumb key={p} path={p} />
                        ))}
                      </div>
                    )}
                    {r.video_url && (
                      <p className="flex items-center gap-2 text-primary">
                        <VideoIcon className="h-4 w-4" /> فيديو مرفق
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      أُنشئ {format(new Date(r.created_at), "dd MMMM yyyy - HH:mm", { locale: ar })}
                    </p>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="mb-2 text-xs font-semibold">سجل الطلب</p>
                      <ReturnHistory returnId={r.id} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/orders/${r.order_id}`)}
                      >
                        عرض الطلب
                      </Button>
                      {(r.status === "awaiting_return" || r.status === "approved") && (
                        <Button size="sm" disabled={shipping === r.id} onClick={() => void markShipped(r.id)}>
                          {shipping === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin ml-1" />
                          ) : (
                            <Truck className="h-4 w-4 ml-1" />
                          )}
                          أرسلت المنتج
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default MyReturns;
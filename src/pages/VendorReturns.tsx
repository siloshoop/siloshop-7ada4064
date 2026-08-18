import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RotateCcw, CheckCircle2, XCircle, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { RETURN_STATUS, RETURN_REASONS, RETURN_NEXT_STATUSES } from "@/lib/returnStatus";
import ReturnTimeline from "@/components/returns/ReturnTimeline";
import ReturnHistory from "@/components/returns/ReturnHistory";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface ReturnRow {
  id: string;
  order_id: string;
  order_item_id: string | null;
  customer_id: string;
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
}

const reasonLabel = (v: string) => RETURN_REASONS.find((r) => r.value === v)?.label || v;

const NEXT_STATUSES = [...RETURN_NEXT_STATUSES];

const DECIDABLE = ["pending", "under_review", "info_requested"];

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
  if (!url) return <div className="w-20 h-20 bg-muted animate-pulse rounded" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="" className="w-20 h-20 rounded object-cover" />
    </a>
  );
};

const ReturnCard = ({ r, onChanged }: { r: ReturnRow; onChanged: () => void }) => {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [nextStatus, setNextStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [instructions, setInstructions] = useState("");
  const [address, setAddress] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const s = RETURN_STATUS[r.status] || RETURN_STATUS.pending;

  const update = async (status: string) => {
    setSaving(true);
    const { error } = await supabase.rpc("update_return_status", {
      _return_id: r.id,
      _new_status: status,
      _note: note || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "تعذر التحديث", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم تحديث الحالة" });
    setNote("");
    setNextStatus("");
    onChanged();
  };

  const submitDecision = async () => {
    if (!decision) return;
    if (decision === "reject" && rejectReason.trim().length < 5) {
      toast({ title: "سبب الرفض مطلوب", variant: "destructive" });
      return;
    }
    if (decision === "approve" && (instructions.trim().length < 5 || address.trim().length < 5)) {
      toast({ title: "تعليمات الإرجاع وعنوان الإرجاع مطلوبان", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("review_return_request", {
      _return_id: r.id,
      _decision: decision,
      _note: decision === "reject" ? rejectReason.trim() : note.trim() || null,
      _instructions: decision === "approve" ? instructions.trim() : null,
      _address: decision === "approve" ? address.trim() : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "تعذر تنفيذ القرار", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: decision === "approve" ? "تمت الموافقة على الإرجاع" : "تم رفض طلب الإرجاع" });
    setDecision(null);
    setInstructions("");
    setAddress("");
    setRejectReason("");
    setNote("");
    onChanged();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-base">
          <span>إرجاع #{r.id.slice(0, 8)} — طلب #{r.order_id.slice(0, 8)}</span>
          <Badge variant={s.variant}>{s.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ReturnTimeline status={r.status} />
        <p>
          <span className="text-muted-foreground">السبب: </span>
          <span className="font-medium">{reasonLabel(r.reason)}</span>
        </p>
        {r.notes && <p className="bg-muted/40 rounded p-2">{r.notes}</p>}
        {r.images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {r.images.map((p) => (
              <MediaThumb key={p} path={p} />
            ))}
          </div>
        )}
        {r.video_url && (
          <button
            type="button"
            onClick={async () => {
              const { data } = await supabase.storage
                .from("returns-media")
                .createSignedUrl(r.video_url as string, 3600);
              if (data?.signedUrl) window.open(data.signedUrl, "_blank");
            }}
            className="text-primary underline"
          >
            عرض الفيديو
          </button>
        )}
        <p className="text-xs text-muted-foreground">
          {format(new Date(r.created_at), "dd MMMM yyyy - HH:mm", { locale: ar })}
        </p>

        <div className="border-t pt-3 space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 1000))}
            placeholder="ملاحظات للمشتري (اختياري)"
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            {DECIDABLE.includes(r.status) && (
              <>
                <Button size="sm" onClick={() => setDecision("approve")} disabled={saving}>
                  <CheckCircle2 className="h-4 w-4 ml-1" /> موافقة
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDecision("reject")}
                  disabled={saving}
                >
                  <XCircle className="h-4 w-4 ml-1" /> رفض
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => update("info_requested")}
                  disabled={saving}
                >
                  <MessageCircle className="h-4 w-4 ml-1" /> طلب معلومات
                </Button>
              </>
            )}
            <Select value={nextStatus} onValueChange={setNextStatus}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="تغيير الحالة" />
              </SelectTrigger>
              <SelectContent>
                {NEXT_STATUSES.filter((x) => x !== r.status).map((x) => (
                  <SelectItem key={x} value={x}>
                    {RETURN_STATUS[x]?.label || x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!nextStatus || saving}
              onClick={() => update(nextStatus)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
              حفظ
            </Button>
          </div>
        </div>

        {r.return_instructions && (
          <div className="rounded border border-primary/20 bg-primary/5 p-2">
            <p className="font-semibold">تعليمات الإرجاع المرسلة للمشتري</p>
            <p>{r.return_instructions}</p>
            {r.return_address && <p className="text-muted-foreground">العنوان: {r.return_address}</p>}
          </div>
        )}
        {r.rejection_reason && (
          <p className="rounded border border-destructive/30 bg-destructive/5 p-2">
            سبب الرفض: {r.rejection_reason}
          </p>
        )}

        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="mb-2 text-xs font-semibold">سجل الطلب</p>
          <ReturnHistory returnId={r.id} />
        </div>
      </CardContent>

      <Dialog open={!!decision} onOpenChange={(o) => !o && !saving && setDecision(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {decision === "approve" ? "الموافقة على الإرجاع" : "رفض طلب الإرجاع"}
            </DialogTitle>
            <DialogDescription>
              {decision === "approve"
                ? "أضف تعليمات الإرجاع وعنوان الاستلام ليتمكن المشتري من إرسال المنتج."
                : "سبب الرفض إلزامي وسيُرسل للمشتري."}
            </DialogDescription>
          </DialogHeader>
          {decision === "approve" ? (
            <div className="space-y-3">
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value.slice(0, 800))}
                placeholder="تعليمات الإرجاع (طريقة التغليف، شركة الشحن، المرفقات المطلوبة...)"
                rows={3}
              />
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value.slice(0, 300))}
                placeholder="عنوان إرجاع المنتج"
              />
            </div>
          ) : (
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value.slice(0, 500))}
              placeholder="سبب الرفض (إلزامي)"
              rows={3}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={() => void submitDecision()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

const VendorReturns = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("returns")
      .select("*")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data as ReturnRow[] | null) || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    if (!user) return;
    const channel = supabase
      .channel(`returns-vendor-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "returns", filter: `vendor_id=eq.${user.id}` },
        () => void load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
          <h1 className="text-2xl font-bold sm:text-3xl">إدارة طلبات الإرجاع</h1>
        </div>
        {rows.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              لا توجد طلبات إرجاع حالياً
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <ReturnCard key={r.id} r={r} onChanged={load} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default VendorReturns;
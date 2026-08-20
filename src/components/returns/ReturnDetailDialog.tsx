import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Package, ShieldCheck, Truck } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  RETURN_STATUS,
  RETURN_NEXT_STATUSES,
  returnStatusLabel,
  canonicalReturnStatus,
} from "@/lib/returnStatus";
import ReturnTimeline from "./ReturnTimeline";
import ReturnChat, { type ReturnMessage } from "./ReturnChat";
import ReturnMedia from "./ReturnMedia";

interface DetailPayload {
  role: "customer" | "vendor" | "admin";
  return: Record<string, unknown> & {
    id: string;
    status: string;
    return_number: string | null;
    order_number: string | null;
    reason_label: string | null;
    description: string | null;
    return_instructions: string | null;
    return_address: string | null;
    rejection_reason: string | null;
    inspection_note: string | null;
    inspection_result: string | null;
    carrier: string | null;
    tracking_number: string | null;
    refund_amount: number | null;
    customer_name: string | null;
    vendor_name: string | null;
    created_at: string;
  };
  items: {
    id: string;
    product_name: string | null;
    product_image: string | null;
    variant_label: string | null;
    quantity: number;
    unit_price: number | null;
  }[];
  images: { id: string; url: string; kind: string | null }[];
  messages: ReturnMessage[];
  notes: { id: string; note: string; author_role: string | null; is_internal: boolean; created_at: string }[];
  timeline: {
    id: string;
    from_status: string | null;
    to_status: string;
    changed_by_role: string | null;
    note: string | null;
    created_at: string;
  }[];
}

const ROLE_LABELS: Record<string, string> = { customer: "المشتري", vendor: "البائع", admin: "الإدارة" };

const ReturnDetailDialog = ({
  returnId,
  open,
  onOpenChange,
  onChanged,
}: {
  returnId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged?: () => void;
}) => {
  const { toast } = useToast();
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [instructions, setInstructions] = useState("");
  const [address, setAddress] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [override, setOverride] = useState("");

  const load = useCallback(async () => {
    if (!returnId) return;
    setLoading(true);
    const { data: res, error } = await supabase.rpc("return_detail", { _return_id: returnId });
    setLoading(false);
    if (error) {
      toast({ title: "تعذر تحميل تفاصيل الإرجاع", description: error.message, variant: "destructive" });
      return;
    }
    setData(res as unknown as DetailPayload);
  }, [returnId, toast]);

  useEffect(() => {
    if (!open || !returnId) return;
    void load();
    void supabase.auth.getUser().then(({ data: u }) => setUserId(u.user?.id ?? null));
    const channel = supabase
      .channel(`return-detail-${returnId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "return_messages", filter: `return_id=eq.${returnId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "returns", filter: `id=eq.${returnId}` }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, returnId, load]);

  const transition = async (toStatus: string, payload: Record<string, unknown> = {}, requiredNote = false) => {
    if (!returnId) return;
    if (requiredNote && note.trim().length < 5) {
      toast({ title: "الملاحظة إلزامية (5 أحرف على الأقل)", variant: "destructive" });
      return;
    }
    setWorking(true);
    const { error } = await supabase.rpc("return_transition", {
      _return_id: returnId,
      _to_status: toStatus,
      _note: note.trim() ? note.trim() : null,
      _payload: payload,
    });
    setWorking(false);
    if (error) {
      const map: Record<string, string> = {
        invalid_transition: "لا يمكن الانتقال إلى هذه الحالة الآن",
        reason_required: "السبب إلزامي",
        instructions_required: "تعليمات الإرجاع إلزامية",
        address_required: "عنوان الإرجاع إلزامي",
        return_closed: "طلب الإرجاع مغلق",
        duplicate_status: "الطلب في هذه الحالة بالفعل",
      };
      toast({
        title: "تعذر تنفيذ الإجراء",
        description: map[error.message] ?? error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "تم تنفيذ الإجراء" });
    setNote("");
    setInstructions("");
    setAddress("");
    setCarrier("");
    setTracking("");
    setOverride("");
    await load();
    onChanged?.();
  };

  const r = data?.return;
  const role = data?.role;
  const status = r ? canonicalReturnStatus(r.status) : "";
  const meta = r ? RETURN_STATUS[r.status] ?? RETURN_STATUS[status] : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <Package className="h-5 w-5 text-primary" />
            <span>إرجاع {r?.return_number ?? ""}</span>
            {r?.order_number && (
              <span className="text-sm text-muted-foreground">— الطلب {r.order_number}</span>
            )}
            {meta && <Badge variant={meta.variant}>{meta.label}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {loading && !data ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : !r ? (
          <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات</p>
        ) : (
          <div className="space-y-4 text-sm">
            <ReturnTimeline status={r.status} />

            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">السبب: </span>
                <span className="font-medium">{r.reason_label}</span>
              </p>
              <p>
                <span className="text-muted-foreground">التاريخ: </span>
                {format(new Date(r.created_at), "dd MMMM yyyy - HH:mm", { locale: ar })}
              </p>
              {role !== "customer" && r.customer_name && (
                <p>
                  <span className="text-muted-foreground">المشتري: </span>
                  {r.customer_name}
                </p>
              )}
              {role !== "vendor" && r.vendor_name && (
                <p>
                  <span className="text-muted-foreground">البائع: </span>
                  {r.vendor_name}
                </p>
              )}
              {r.refund_amount != null && (
                <p>
                  <span className="text-muted-foreground">مبلغ التعويض: </span>
                  {Number(r.refund_amount).toLocaleString("ar-SY")} ل.س
                </p>
              )}
            </div>

            {r.description && <p className="rounded bg-muted/40 p-2 whitespace-pre-wrap">{r.description}</p>}

            {data.items.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold">المنتجات المرتجعة</p>
                {data.items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded border p-2">
                    {it.product_image ? (
                      <img src={it.product_image} alt={it.product_name ?? ""} className="h-12 w-12 rounded object-cover" loading="lazy" />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{it.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        الكمية: {it.quantity}
                        {it.variant_label ? ` · ${it.variant_label}` : ""}
                        {it.unit_price != null ? ` · ${Number(it.unit_price).toLocaleString("ar-SY")} ل.س` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data.images.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold">الصور المرفقة</p>
                <div className="flex flex-wrap gap-2">
                  {data.images.map((im) => (
                    <ReturnMedia key={im.id} path={im.url} />
                  ))}
                </div>
              </div>
            )}

            {(r.return_instructions || r.return_address) && (
              <div className="space-y-1 rounded border border-primary/20 bg-primary/5 p-2">
                {r.return_instructions && (
                  <p>
                    <span className="font-semibold">تعليمات الإرجاع: </span>
                    {r.return_instructions}
                  </p>
                )}
                {r.return_address && (
                  <p className="flex items-start gap-1">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span>{r.return_address}</span>
                  </p>
                )}
              </div>
            )}

            {(r.carrier || r.tracking_number) && (
              <p className="flex items-center gap-2 rounded border p-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span>
                  {r.carrier} {r.tracking_number ? `· ${r.tracking_number}` : ""}
                </span>
              </p>
            )}

            {r.rejection_reason && (
              <p className="rounded border border-destructive/30 bg-destructive/5 p-2">
                <span className="font-semibold">سبب الرفض: </span>
                {r.rejection_reason}
              </p>
            )}

            {r.inspection_note && (
              <p className="rounded border p-2">
                <span className="font-semibold">نتيجة الفحص: </span>
                {r.inspection_result === "accepted" ? "مقبول" : "مرفوض"} — {r.inspection_note}
              </p>
            )}

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-semibold">المحادثة</p>
              <ReturnChat
                returnId={r.id}
                messages={data.messages}
                currentUserId={userId}
                onSent={() => void load()}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-semibold">الإجراءات</p>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 1000))}
                rows={2}
                placeholder="ملاحظة تُسجَّل في السجل وتُرسل للطرف الآخر (إلزامية للرفض وطلب المعلومات)"
              />

              {role === "customer" && (
                <div className="flex flex-wrap gap-2">
                  {["pending_review", "seller_reviewing", "waiting_customer"].includes(status) && (
                    <Button variant="destructive" size="sm" disabled={working} onClick={() => void transition("cancelled")}>
                      إلغاء طلب الإرجاع
                    </Button>
                  )}
                  {status === "waiting_customer" && (
                    <Button size="sm" disabled={working} onClick={() => void transition("pending_review", {}, true)}>
                      إرسال المعلومات المطلوبة
                    </Button>
                  )}
                  {status === "approved" && (
                    <div className="flex w-full flex-wrap items-center gap-2">
                      <Input
                        value={carrier}
                        onChange={(e) => setCarrier(e.target.value.slice(0, 80))}
                        placeholder="شركة الشحن"
                        className="w-40"
                      />
                      <Input
                        value={tracking}
                        onChange={(e) => setTracking(e.target.value.slice(0, 80))}
                        placeholder="رقم التتبع"
                        className="w-40"
                      />
                      <Button
                        size="sm"
                        disabled={working}
                        onClick={() =>
                          void transition("customer_shipping", {
                            carrier: carrier.trim(),
                            tracking_number: tracking.trim(),
                          })
                        }
                      >
                        <Truck className="ml-1 h-4 w-4" /> أرسلت المنتج
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {role === "vendor" && (
                <div className="space-y-2">
                  {status === "pending_review" && (
                    <Button size="sm" variant="secondary" disabled={working} onClick={() => void transition("seller_reviewing")}>
                      بدء المراجعة
                    </Button>
                  )}
                  {["pending_review", "seller_reviewing", "waiting_customer"].includes(status) && (
                    <div className="space-y-2 rounded border p-2">
                      <Textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value.slice(0, 800))}
                        rows={2}
                        placeholder="تعليمات الإرجاع (إلزامية للموافقة)"
                      />
                      <Input
                        value={address}
                        onChange={(e) => setAddress(e.target.value.slice(0, 300))}
                        placeholder="عنوان استلام المرتجع (إلزامي للموافقة)"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={working}
                          onClick={() =>
                            void transition("approved", {
                              instructions: instructions.trim(),
                              address: address.trim(),
                            })
                          }
                        >
                          موافقة
                        </Button>
                        <Button size="sm" variant="destructive" disabled={working} onClick={() => void transition("rejected", {}, true)}>
                          رفض
                        </Button>
                        <Button size="sm" variant="outline" disabled={working} onClick={() => void transition("waiting_customer", {}, true)}>
                          طلب معلومات إضافية
                        </Button>
                      </div>
                    </div>
                  )}
                  {status === "customer_shipping" && (
                    <Button size="sm" disabled={working} onClick={() => void transition("seller_inspecting")}>
                      <ShieldCheck className="ml-1 h-4 w-4" /> استلمت المنتج — بدء الفحص
                    </Button>
                  )}
                  {status === "seller_inspecting" && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={working} onClick={() => void transition("inspection_passed")}>
                        نجح الفحص
                      </Button>
                      <Button size="sm" variant="destructive" disabled={working} onClick={() => void transition("inspection_failed", {}, true)}>
                        فشل الفحص
                      </Button>
                    </div>
                  )}
                  {["inspection_passed", "inspection_failed"].includes(status) && (
                    <Button size="sm" disabled={working} onClick={() => void transition("completed")}>
                      إغلاق وإكمال الإرجاع
                    </Button>
                  )}
                </div>
              )}

              {role === "admin" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={override} onValueChange={setOverride}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="تجاوز الحالة (الإدارة)" />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_NEXT_STATUSES.filter((x) => x !== r.status).map((x) => (
                        <SelectItem key={x} value={x}>
                          {returnStatusLabel(x)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="secondary" disabled={!override || working} onClick={() => void transition(override)}>
                    تطبيق
                  </Button>
                </div>
              )}
            </div>

            {data.notes.length > 0 && (
              <div className="space-y-1 rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold">الملاحظات</p>
                {data.notes.map((n) => (
                  <p key={n.id} className="text-xs">
                    <span className="font-medium">{ROLE_LABELS[n.author_role ?? ""] ?? "مستخدم"}</span>
                    {n.is_internal && <Badge variant="outline" className="mx-1 text-[10px]">داخلية</Badge>}
                    : {n.note}
                  </p>
                ))}
              </div>
            )}

            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold">السجل الزمني الكامل</p>
              {data.timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا يوجد سجل بعد</p>
              ) : (
                <ul className="space-y-2 border-s ps-3">
                  {data.timeline.map((h) => (
                    <li key={h.id} className="text-xs">
                      <span className="font-semibold">{returnStatusLabel(h.to_status)}</span>
                      {h.changed_by_role && (
                        <span className="text-muted-foreground"> — {ROLE_LABELS[h.changed_by_role] ?? h.changed_by_role}</span>
                      )}
                      <span className="text-muted-foreground">
                        {" "}
                        · {format(new Date(h.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
                      </span>
                      {h.note && <p className="text-muted-foreground">{h.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReturnDetailDialog;

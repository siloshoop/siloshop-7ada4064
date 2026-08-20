import { useEffect, useState } from "react";
import { Loader2, Send, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { friendlyOrderError } from "@/lib/orderStatus";
import { addOrderNote, fetchOrderNotes, type OrderNote } from "@/lib/sellerOrders";

const ROLE_LABELS: Record<string, string> = {
  seller: "أنت (البائع)",
  admin: "الإدارة",
  customer: "العميل",
  system: "النظام",
};

const SellerOrderNotes = ({ orderId }: { orderId: string }) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(true);
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const rows = await fetchOrderNotes(orderId);
      setNotes(rows);
    } catch (e) {
      toast({ title: "خطأ", description: friendlyOrderError(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await addOrderNote(orderId, text.trim(), internal);
      setText("");
      await load();
    } catch (e) {
      toast({ title: "خطأ", description: friendlyOrderError(e), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3" dir="rtl">
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد ملاحظات بعد.</p>
      ) : (
        <ul className="space-y-2 max-h-56 overflow-y-auto pe-1">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border bg-muted/40 p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-medium text-xs">{n.author_name || ROLE_LABELS[n.author_role || ""] || "مستخدم"}</span>
                <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[n.author_role || ""] || n.author_role}</Badge>
                {n.is_internal && (
                  <Badge variant="secondary" className="text-[10px] gap-1"><Lock className="h-3 w-3" /> ملاحظة داخلية</Badge>
                )}
                <span className="text-[11px] text-muted-foreground ms-auto">
                  {new Date(n.created_at).toLocaleString("ar-SY")}
                </span>
              </div>
              <p>{n.note}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2 border-t pt-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="أضف ملاحظة على الطلب..."
          rows={2}
          maxLength={500}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={internal} onCheckedChange={(v) => setInternal(!!v)} />
            ملاحظة داخلية (لا يراها العميل)
          </label>
          <Button size="sm" className="gap-2" onClick={handleSend} disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            إرسال
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SellerOrderNotes;

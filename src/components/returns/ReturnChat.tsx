import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import ReturnMedia from "./ReturnMedia";

export interface ReturnMessage {
  id: string;
  sender_id: string;
  sender_role: string | null;
  body: string;
  attachments: string[] | null;
  is_read: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  customer: "المشتري",
  vendor: "البائع",
  admin: "الإدارة",
};

/** Realtime conversation attached to a return request (customer / seller / admin). */
const ReturnChat = ({
  returnId,
  messages,
  currentUserId,
  onSent,
}: {
  returnId: string;
  messages: ReturnMessage[];
  currentUserId?: string | null;
  onSent: () => void;
}) => {
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  useEffect(() => {
    void supabase.rpc("return_mark_read", { _return_id: returnId });
  }, [returnId, messages.length]);

  const send = async () => {
    const text = body.trim();
    if (text.length < 1) return;
    setSending(true);
    const { error } = await supabase.rpc("return_send_message", {
      _return_id: returnId,
      _body: text.slice(0, 2000),
      _attachments: [],
    });
    setSending(false);
    if (error) {
      toast({ title: "تعذر إرسال الرسالة", description: error.message, variant: "destructive" });
      return;
    }
    setBody("");
    onSent();
  };

  return (
    <div className="space-y-3" dir="rtl">
      <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-3">
        {messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">لا توجد رسائل بعد — ابدأ المحادثة</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    mine ? "bg-primary text-primary-foreground" : "border bg-card"
                  )}
                >
                  <p className="mb-1 text-[10px] opacity-80">
                    {ROLE_LABELS[m.sender_role ?? ""] ?? "مستخدم"} ·{" "}
                    {format(new Date(m.created_at), "dd MMM - HH:mm", { locale: ar })}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.attachments.map((a) => (
                        <ReturnMedia key={a} path={a} size="h-14 w-14" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 2000))}
          rows={2}
          placeholder="اكتب رسالتك..."
          className="flex-1"
        />
        <Button size="sm" disabled={sending || !body.trim()} onClick={() => void send()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

export default ReturnChat;

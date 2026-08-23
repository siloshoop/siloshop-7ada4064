import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { ChatConversation } from "@/hooks/useChatConversations";
import type { ChatMessage } from "@/hooks/useChatThread";

interface Props {
  message: ChatMessage | null;
  onClose: () => void;
  onForward: (messageId: string, targetConversationId: string) => Promise<boolean>;
}

/** Pick another conversation to forward a message into. */
const ForwardMessageDialog = ({ message, onClose, onForward }: Props) => {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    let active = true;
    setLoading(true);
    supabase
      .rpc("list_conversations", { p_search: search || null, p_archived: false, p_limit: 30, p_offset: 0 })
      .then(({ data }) => {
        if (!active) return;
        setItems(((data as ChatConversation[]) || []).filter((c) => c.id !== message.conversation_id));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [message, search]);

  return (
    <Dialog open={!!message} onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>تحويل الرسالة</DialogTitle>
        </DialogHeader>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن محادثة..."
        />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">لا توجد محادثات أخرى</p>
          ) : (
            items.map((c) => (
              <Button
                key={c.id}
                variant="ghost"
                className="w-full justify-between"
                disabled={!!busyId}
                onClick={async () => {
                  if (!message) return;
                  setBusyId(c.id);
                  const ok = await onForward(message.id, c.id);
                  setBusyId(null);
                  if (ok) onClose();
                }}
              >
                <span className="truncate">{c.peer_name || "مستخدم"}</span>
                {busyId === c.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {c.order_number || c.return_number || c.subject || ""}
                  </span>
                )}
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ForwardMessageDialog;

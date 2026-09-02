import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Loader2,
  Package,
  Pin,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useChatThread, type ChatMessage } from "@/hooks/useChatThread";
import ChatComposer from "./ChatComposer";
import ChatMessageItem from "./ChatMessageItem";
import ForwardMessageDialog from "./ForwardMessageDialog";

interface Props {
  conversationId: string;
  peerName?: string | null;
  peerAvatar?: string | null;
  isArchived?: boolean;
  onBack?: () => void;
  onChanged?: () => void;
}

const ChatWindow = ({
  conversationId,
  peerName,
  peerAvatar,
  isArchived,
  onBack,
  onChanged,
}: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const thread = useChatThread(conversationId);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);
  const firstId = useRef<string | null>(null);
  const prevScrollHeight = useRef(0);

  useEffect(() => {
    const msgs = thread.messages;
    if (msgs.length === lastCount.current) return;
    const newFirstId = msgs[0]?.id ?? null;
    const prepended = firstId.current !== null && newFirstId !== firstId.current;
    lastCount.current = msgs.length;
    firstId.current = newFirstId;

    if (prepended) {
      // Older history loaded: keep the reader anchored where they were.
      const el = scrollRef.current;
      if (el) {
        const delta = el.scrollHeight - prevScrollHeight.current;
        if (delta > 0) el.scrollTop = el.scrollTop + delta;
      }
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.messages, thread.peerTyping]);


  const pinned = thread.messages.filter((m) => m.is_pinned);
  const visible = query.trim()
    ? thread.messages.filter((m) => (m.content || "").toLowerCase().includes(query.trim().toLowerCase()))
    : thread.messages;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "تم نسخ الرسالة" });
    } catch {
      toast({ title: "تعذر النسخ", variant: "destructive" });
    }
  };

  const toggleArchive = async () => {
    const { error } = await supabase.rpc("set_conversation_archived", {
      p_conversation_id: conversationId,
      p_archived: !isArchived,
    });
    if (error) {
      toast({ title: "تعذر تحديث الأرشيف", variant: "destructive" });
      return;
    }
    toast({ title: isArchived ? "تم إرجاع المحادثة" : "تم أرشفة المحادثة" });
    onChanged?.();
  };

  const header = thread.header;

  return (
    <div className="flex h-full min-h-0 flex-col" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2 border-b bg-card p-3">
        {onBack && (
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="رجوع">
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
        )}
        <Avatar className="h-10 w-10">
          <AvatarImage src={peerAvatar || undefined} alt={peerName || "مستخدم"} />
          <AvatarFallback>{(peerName || "؟").charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{peerName || "مستخدم"}</p>
          <p className="text-xs text-muted-foreground">
            {thread.peerTyping
              ? "يكتب الآن..."
              : thread.peerOnline
                ? "متصل الآن"
                : thread.peerLastSeen
                  ? `آخر ظهور ${formatDistanceToNow(new Date(thread.peerLastSeen), { addSuffix: true, locale: ar })}`
                  : "غير متصل"}
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSearching((v) => !v)}
          aria-label="بحث في المحادثة"
        >
          {searching ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => void toggleArchive()} aria-label="أرشفة">
          {isArchived ? <ArchiveRestore className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
        </Button>
      </div>

      {/* Context strip */}
      {header && (header.order_id || header.product_id) && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2 text-xs">
          <Package className="h-3.5 w-3.5" />
          {header.order_id && (
            <Link to={`/orders/${header.order_id}`} className="underline">
              {header.subject || "تفاصيل الطلب"}
            </Link>
          )}
          {!header.order_id && header.product_id && (
            <Link to={`/product/${header.product_id}`} className="underline">
              المنتج المرتبط
            </Link>
          )}
          {header.admin_id && <Badge variant="secondary">الدعم مشارك</Badge>}
        </div>
      )}

      {searching && (
        <div className="border-b p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في الرسائل..."
          />
        </div>
      )}

      {pinned.length > 0 && !searching && (
        <div className="flex items-start gap-2 border-b bg-primary/5 px-3 py-2 text-xs">
          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="line-clamp-2">{pinned[pinned.length - 1].content || "مرفق مثبّت"}</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {thread.loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {thread.hasMore && !query && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    prevScrollHeight.current = scrollRef.current?.scrollHeight ?? 0;
                    void thread.loadMore();
                  }}
                  disabled={thread.loadingMore}
                >

                  {thread.loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "تحميل رسائل أقدم"}
                </Button>
              </div>
            )}
            {visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {query ? "لا نتائج مطابقة" : "لا توجد رسائل بعد — ابدأ المحادثة"}
              </p>
            ) : (
              visible.map((m) => (
                <ChatMessageItem
                  key={m.id}
                  message={m}
                  isMine={m.sender_id === user?.id}
                  onReply={setReplyTo}
                  onForward={setForwarding}
                  onEdit={thread.editMessage}
                  onDelete={thread.deleteMessage}
                  onPin={thread.pinMessage}
                  onCopy={copy}
                />
              ))
            )}
            {thread.peerTyping && (
              <p className="text-xs text-muted-foreground">يكتب الآن...</p>
            )}
            <div ref={endRef} />
          </>
        )}
      </div>

      {thread.disabledReason && (
        <div className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {thread.disabledReason}
        </div>
      )}

      <ChatComposer
        disabled={thread.disabled}
        sending={thread.sending}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onTyping={thread.broadcastTyping}
        onSend={thread.send}
      />

      <ForwardMessageDialog
        message={forwarding}
        onClose={() => setForwarding(null)}
        onForward={thread.forwardMessage}
      />
    </div>
  );
};

export default ChatWindow;

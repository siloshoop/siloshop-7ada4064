import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { uploadChatFiles, type ChatAttachment } from "@/lib/chatFiles";

const PAGE_SIZE = 40;

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar: string | null;
  content: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  reply_to_id: string | null;
  reply_preview: string | null;
  reply_sender_id: string | null;
  forwarded_from_id: string | null;
  edited_at: string | null;
  is_pinned: boolean;
  is_deleted: boolean;
  deleted_by_sender: boolean;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  attachments: ChatAttachment[];
}

export interface ChatHeader {
  id: string;
  customer_id: string;
  vendor_id: string;
  admin_id: string | null;
  product_id: string | null;
  order_id: string | null;
  return_id: string | null;
  context_type: string;
  subject: string | null;
  is_blocked: boolean;
  is_suspended: boolean;
  suspended_until: string | null;
  moderation_reason: string | null;
}

const ERROR_TEXT: Record<string, string> = {
  not_authenticated: "يجب تسجيل الدخول",
  not_authorized: "غير مصرح لك بهذا الإجراء",
  conversation_unavailable: "المحادثة غير متاحة حالياً",
  empty_message: "لا يمكن إرسال رسالة فارغة",
  message_too_long: "الرسالة طويلة جداً",
  edit_window_expired: "انتهت مدة تعديل الرسالة (15 دقيقة)",
  not_editable: "لا يمكن تعديل هذا النوع من الرسائل",
  message_deleted: "الرسالة محذوفة",
  cannot_message_self: "لا يمكنك مراسلة نفسك",
  vendor_not_found: "البائع غير موجود",
  order_not_found: "الطلب غير موجود",
  return_not_found: "طلب الإرجاع غير موجود",
};

export const chatErrorText = (message?: string) => {
  if (!message) return "حدث خطأ غير متوقع";
  const key = Object.keys(ERROR_TEXT).find((k) => message.includes(k));
  return key ? ERROR_TEXT[key] : message;
};

/** Full realtime chat thread: messages, pagination, typing, presence, actions. */
export const useChatThread = (conversationId: string | null) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [header, setHeader] = useState<ChatHeader | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerLastSeen, setPeerLastSeen] = useState<string | null>(null);

  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  const peerId = header
    ? header.customer_id === user?.id
      ? header.vendor_id
      : header.customer_id
    : null;

  const suspensionActive =
    !!header?.is_suspended &&
    (!header.suspended_until || new Date(header.suspended_until) > new Date());
  const disabled = !!header?.is_blocked || suspensionActive;
  const disabledReason = header?.is_blocked
    ? header.moderation_reason
      ? `تم حظر هذه المحادثة: ${header.moderation_reason}`
      : "تم حظر هذه المحادثة من قبل الإدارة."
    : suspensionActive
      ? header?.moderation_reason
        ? `المحادثة معلّقة مؤقتاً: ${header.moderation_reason}`
        : "المحادثة معلّقة مؤقتاً."
      : null;

  const fetchPage = useCallback(
    async (before?: string) => {
      if (!conversationId) return [] as ChatMessage[];
      const { data } = await supabase.rpc("list_chat_messages", {
        p_conversation_id: conversationId,
        p_before: before ?? null,
        p_limit: PAGE_SIZE,
      });
      const rows = ((data as unknown as ChatMessage[]) || []).map((m) => ({
        ...m,
        attachments: (m.attachments as unknown as ChatAttachment[]) || [],
      }));
      setHasMore(rows.length === PAGE_SIZE);
      return rows.reverse();
    },
    [conversationId],
  );

  const loadHeader = useCallback(async () => {
    if (!conversationId) return;
    const { data } = await supabase
      .from("conversations")
      .select(
        "id, customer_id, vendor_id, admin_id, product_id, order_id, return_id, context_type, subject, is_blocked, is_suspended, suspended_until, moderation_reason",
      )
      .eq("id", conversationId)
      .maybeSingle();
    if (data) setHeader(data as ChatHeader);
  }, [conversationId]);

  // Initial load + realtime subscriptions
  useEffect(() => {
    if (!conversationId || !user) return;
    let active = true;
    setLoading(true);

    const init = async () => {
      await loadHeader();
      const rows = await fetchPage();
      if (!active) return;
      setMessages(rows);
      setLoading(false);
      await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
      await supabase.rpc("touch_conversation_presence", { p_conversation_id: conversationId });
    };
    void init();

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async () => {
          const rows = await fetchPage();
          if (!active) return;
          setMessages((prev) => {
            const map = new Map(prev.map((m) => [m.id, m]));
            rows.forEach((r) => map.set(r.id, r));
            return Array.from(map.values()).sort(
              (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
            );
          });
          await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as Partial<ChatMessage> & { id: string };
          setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` },
        (payload) => setHeader((h) => (h ? { ...h, ...(payload.new as ChatHeader) } : h)),
      )
      .subscribe();

    const presence = supabase.channel(`presence-${conversationId}`, {
      config: { presence: { key: user.id }, broadcast: { self: false } },
    });
    presence
      .on("broadcast", { event: "typing" }, (payload) => {
        if ((payload.payload as { userId?: string })?.userId === user.id) return;
        setPeerTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setPeerTyping(false), 3000);
      })
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState();
        setPeerOnline(Object.keys(state).some((k) => k !== user.id));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void presence.track({ online_at: new Date().toISOString() });
      });
    typingChannel.current = presence;

    const presenceTimer = setInterval(() => {
      void supabase.rpc("touch_conversation_presence", { p_conversation_id: conversationId });
    }, 60000);

    return () => {
      active = false;
      clearInterval(presenceTimer);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      supabase.removeChannel(channel);
      supabase.removeChannel(presence);
      typingChannel.current = null;
    };
  }, [conversationId, user, fetchPage, loadHeader]);

  // Peer "last seen" from participant row
  useEffect(() => {
    if (!conversationId || !peerId) return;
    const load = async () => {
      const { data } = await supabase
        .from("conversation_participants")
        .select("last_seen_at")
        .eq("conversation_id", conversationId)
        .eq("user_id", peerId)
        .maybeSingle();
      setPeerLastSeen(data?.last_seen_at ?? null);
    };
    void load();
    const channel = supabase
      .channel(`peer-seen-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { user_id: string; last_seen_at: string | null };
          if (row.user_id === peerId) setPeerLastSeen(row.last_seen_at);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, peerId]);

  const loadMore = useCallback(async () => {
    if (!messages.length || loadingMore) return;
    setLoadingMore(true);
    const rows = await fetchPage(messages[0].created_at);
    setMessages((prev) => [...rows, ...prev]);
    setLoadingMore(false);
  }, [messages, loadingMore, fetchPage]);

  const broadcastTyping = useCallback(() => {
    if (!typingChannel.current || !user || disabled) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 1500) return;
    lastTypingSent.current = now;
    void typingChannel.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id },
    });
  }, [user, disabled]);

  const send = useCallback(
    async (text: string, files: File[], replyToId: string | null) => {
      if (!conversationId) return false;
      setSending(true);
      try {
        let attachments: unknown[] = [];
        if (files.length) {
          const { attachments: uploaded, errors } = await uploadChatFiles(conversationId, files);
          if (errors.length) {
            toast({ title: "بعض الملفات لم تُرفع", description: errors.join(" • "), variant: "destructive" });
          }
          attachments = uploaded;
        }
        if (!text.trim() && attachments.length === 0) return false;

        const messageType = attachments.length
          ? (attachments[0] as { mime_type: string }).mime_type.startsWith("image/")
            ? "image"
            : "file"
          : "text";

        const { error } = await supabase.rpc("send_chat_message", {
          p_conversation_id: conversationId,
          p_content: text.trim() || null,
          p_message_type: messageType,
          p_reply_to_id: replyToId,
          p_attachments: attachments as never,
        });
        if (error) {
          toast({ title: "تعذر الإرسال", description: chatErrorText(error.message), variant: "destructive" });
          return false;
        }
        return true;
      } finally {
        setSending(false);
      }
    },
    [conversationId, toast],
  );

  const editMessage = useCallback(
    async (id: string, content: string) => {
      const { error } = await supabase.rpc("edit_chat_message", { p_message_id: id, p_content: content });
      if (error) {
        toast({ title: "تعذر التعديل", description: chatErrorText(error.message), variant: "destructive" });
        return false;
      }
      return true;
    },
    [toast],
  );

  const deleteMessage = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("delete_own_chat_message", { p_message_id: id });
      if (error) {
        toast({ title: "تعذر الحذف", description: chatErrorText(error.message), variant: "destructive" });
        return false;
      }
      return true;
    },
    [toast],
  );

  const pinMessage = useCallback(
    async (id: string, pin: boolean) => {
      const { error } = await supabase.rpc("pin_chat_message", { p_message_id: id, p_pin: pin });
      if (error) {
        toast({ title: "تعذر التثبيت", description: chatErrorText(error.message), variant: "destructive" });
        return false;
      }
      return true;
    },
    [toast],
  );

  const forwardMessage = useCallback(
    async (id: string, targetConversationId: string) => {
      const { error } = await supabase.rpc("forward_chat_message", {
        p_message_id: id,
        p_target_conversation_id: targetConversationId,
      });
      if (error) {
        toast({ title: "تعذر التحويل", description: chatErrorText(error.message), variant: "destructive" });
        return false;
      }
      toast({ title: "تم تحويل الرسالة" });
      return true;
    },
    [toast],
  );

  return {
    header,
    messages,
    loading,
    loadingMore,
    hasMore,
    sending,
    peerTyping,
    peerOnline,
    peerLastSeen,
    peerId,
    disabled,
    disabledReason,
    loadMore,
    broadcastTyping,
    send,
    editMessage,
    deleteMessage,
    pinMessage,
    forwardMessage,
    reload: async () => setMessages(await fetchPage()),
  };
};

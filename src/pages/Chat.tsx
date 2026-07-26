import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Send, Image as ImageIcon, Paperclip, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  is_read: boolean;
  is_deleted?: boolean;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

const Chat = () => {
  const { vendorId } = useParams();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("product");
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [vendorProfile, setVendorProfile] = useState<Profile | null>(null);
  const [convState, setConvState] = useState<{
    is_blocked: boolean;
    is_suspended: boolean;
    suspended_until: string | null;
    moderation_reason: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const suspensionActive =
    !!convState?.is_suspended &&
    (!convState.suspended_until || new Date(convState.suspended_until) > new Date());
  const chatDisabled = !!convState?.is_blocked || suspensionActive;
  const disabledReason = convState?.is_blocked
    ? convState.moderation_reason
      ? `تم حظر هذه المحادثة: ${convState.moderation_reason}`
      : "تم حظر هذه المحادثة من قبل الإدارة."
    : suspensionActive
      ? convState?.moderation_reason
        ? `المحادثة معلّقة مؤقتاً: ${convState.moderation_reason}`
        : "المحادثة معلّقة مؤقتاً."
      : null;

  useEffect(() => {
    if (!user || !vendorId) return;

    const initChat = async () => {
      // Fetch vendor profile using secure function (excludes phone number)
      const { data: profiles } = await supabase
        .rpc("get_vendor_public_info", { vendor_id: vendorId });

      if (profiles && profiles.length > 0) {
        setVendorProfile(profiles[0]);
      }

      // Find or create the conversation atomically (null-safe on product_id,
      // prevents self-conversations, validates vendor).
      const { data: convId, error: convErr } = await supabase.rpc(
        "get_or_create_conversation",
        { p_vendor_id: vendorId, p_product_id: productId || null }
      );

      if (convErr || !convId) {
        toast({
          title: "خطأ",
          description: convErr?.message || "فشل في إنشاء المحادثة",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const conversationRow = { id: convId as string };
      setConversationId(conversationRow.id);

      // Load moderation state
      const { data: convRow } = await supabase
        .from("conversations")
        .select("is_blocked, is_suspended, suspended_until, moderation_reason")
        .eq("id", conversationRow.id)
        .maybeSingle();
      if (convRow) setConvState(convRow as typeof convState);

      // Fetch messages
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationRow.id)
        .order("created_at", { ascending: true });

      setMessages(msgs || []);
      setLoading(false);

      // Mark messages as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationRow.id)
        .neq("sender_id", user.id);

      // Subscribe to new messages
      const channel = supabase
        .channel(`messages-${conversationRow.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationRow.id}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as Message]);
            if (payload.new.sender_id !== user.id) {
              supabase
                .from("messages")
                .update({ is_read: true })
                .eq("id", payload.new.id);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationRow.id}`,
          },
          (payload) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === (payload.new as Message).id ? (payload.new as Message) : m)),
            );
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "conversations",
            filter: `id=eq.${conversationRow.id}`,
          },
          (payload) => {
            const c = payload.new as {
              is_blocked: boolean;
              is_suspended: boolean;
              suspended_until: string | null;
              moderation_reason: string | null;
            };
            setConvState({
              is_blocked: c.is_blocked,
              is_suspended: c.is_suspended,
              suspended_until: c.suspended_until,
              moderation_reason: c.moderation_reason,
            });
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    initChat();
  }, [user, vendorId, productId, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !user) return;
    if (chatDisabled) return;

    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: newMessage,
      message_type: "text",
    });

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في إرسال الرسالة",
        variant: "destructive",
      });
    } else {
      setNewMessage("");
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    }
    setSending(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId || !user) return;
    if (chatDisabled) {
      toast({ title: "المحادثة غير متاحة", variant: "destructive" });
      return;
    }

    setSending(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `chat/${conversationId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, file);

    if (uploadError) {
      toast({
        title: "خطأ",
        description: "فشل في رفع الملف",
        variant: "destructive",
      });
      setSending(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("product-images").getPublicUrl(filePath);

    const messageType = file.type.startsWith("image/") ? "image" : "file";

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      message_type: messageType,
      file_url: publicUrl,
      file_name: file.name,
      content: messageType === "image" ? "صورة" : file.name,
    });

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في إرسال الملف",
        variant: "destructive",
      });
    } else {
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="p-4 border-b flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <img
              src={vendorProfile?.avatar_url || "/placeholder.svg"}
              alt={vendorProfile?.full_name || "بائع"}
            />
          </Avatar>
          <div>
            <h2 className="font-bold">{vendorProfile?.full_name || "بائع"}</h2>
            <p className="text-sm text-muted-foreground">نشط</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isSender = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isSender ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    isSender
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.message_type === "image" && msg.file_url && (
                    <img
                      src={msg.file_url}
                      alt="صورة"
                      className="rounded mb-2 max-w-full"
                    />
                  )}
                  {msg.message_type === "file" && msg.file_url && (
                    <a
                      href={msg.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 underline"
                    >
                      <Paperclip className="h-4 w-4" />
                      {msg.file_name}
                    </a>
                  )}
                  {msg.content && <p>{msg.content}</p>}
                  <p className="text-xs opacity-70 mt-1">
                    {formatDistanceToNow(new Date(msg.created_at), {
                      addSuffix: true,
                      locale: ar,
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {disabledReason && (
          <div className="px-4 py-2 text-sm text-center bg-destructive/10 text-destructive border-t border-destructive/30">
            {disabledReason}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || chatDisabled}
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={chatDisabled ? "الإرسال غير متاح" : "اكتب رسالة..."}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={sending || chatDisabled}
          />
          <Button onClick={handleSendMessage} disabled={sending || chatDisabled || !newMessage.trim()}>
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Chat;

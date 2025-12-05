import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Send, Image as ImageIcon, Paperclip, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
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
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || !vendorId) return;

    const initChat = async () => {
      // Fetch vendor profile using secure function (excludes phone number)
      const { data: profiles } = await supabase
        .rpc("get_vendor_public_info", { vendor_id: vendorId });

      if (profiles && profiles.length > 0) {
        setVendorProfile(profiles[0]);
      }

      // Check if conversation exists
      let { data: conversation } = await supabase
        .from("conversations")
        .select("*")
        .eq("customer_id", user.id)
        .eq("vendor_id", vendorId)
        .eq("product_id", productId || null)
        .single();

      // Create conversation if it doesn't exist
      if (!conversation) {
        const { data: newConv, error } = await supabase
          .from("conversations")
          .insert({
            customer_id: user.id,
            vendor_id: vendorId,
            product_id: productId || null,
          })
          .select()
          .single();

        if (error) {
          toast({
            title: "خطأ",
            description: "فشل في إنشاء المحادثة",
            variant: "destructive",
          });
          return;
        }
        conversation = newConv;
      }

      setConversationId(conversation.id);

      // Fetch messages
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      setMessages(msgs || []);
      setLoading(false);

      // Mark messages as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversation.id)
        .neq("sender_id", user.id);

      // Subscribe to new messages
      const channel = supabase
        .channel(`messages-${conversation.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversation.id}`,
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
            disabled={sending}
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="اكتب رسالة..."
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={sending}
          />
          <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
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

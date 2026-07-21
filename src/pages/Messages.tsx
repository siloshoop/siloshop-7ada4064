import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface Conversation {
  id: string;
  vendor_id: string;
  customer_id: string;
  product_id: string | null;
  last_message_at: string;
  otherProfile?: { id: string; full_name: string | null; avatar_url: string | null } | null;
  lastMessage?: string | null;
  unread?: number;
}

const Messages = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }

    const load = async () => {
      setLoading(true);
      const { data: convs } = await supabase
        .from("conversations")
        .select("*")
        .or(`customer_id.eq.${user.id},vendor_id.eq.${user.id}`)
        .order("last_message_at", { ascending: false });

      const list: Conversation[] = convs || [];

      const enriched = await Promise.all(
        list.map(async (c) => {
          const otherId = c.customer_id === user.id ? c.vendor_id : c.customer_id;
          const [{ data: prof }, { data: msgs }, { count: unread }] = await Promise.all([
            supabase.rpc("get_vendor_public_info", { vendor_id: otherId }),
            supabase
              .from("messages")
              .select("content, message_type, created_at")
              .eq("conversation_id", c.id)
              .order("created_at", { ascending: false })
              .limit(1),
            supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", c.id)
              .eq("is_read", false)
              .neq("sender_id", user.id),
          ]);

          const last = msgs?.[0];
          return {
            ...c,
            otherProfile: prof && prof.length ? prof[0] : { id: otherId, full_name: null, avatar_url: null },
            lastMessage: last ? (last.message_type === "text" ? last.content : "📎 مرفق") : null,
            unread: unread || 0,
          } as Conversation;
        })
      );

      setItems(enriched);
      setLoading(false);
    };

    load();
  }, [user, authLoading, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <MessageSquare className="h-6 w-6" /> الرسائل
        </h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            لا توجد محادثات بعد.
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <Link
                key={c.id}
                to={`/chat/${c.customer_id === user!.id ? c.vendor_id : c.customer_id}${c.product_id ? `?product=${c.product_id}` : ""}`}
              >
                <Card className="p-4 flex items-center gap-3 hover:bg-accent transition-colors">
                  <Avatar>
                    <AvatarImage src={c.otherProfile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {c.otherProfile?.full_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                      <p className="font-semibold truncate">
                        {c.otherProfile?.full_name || "مستخدم"}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: ar })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {c.lastMessage || "ابدأ المحادثة"}
                    </p>
                  </div>
                  {c.unread ? (
                    <span className="bg-primary text-primary-foreground rounded-full text-xs px-2 py-0.5 shrink-0">
                      {c.unread}
                    </span>
                  ) : null}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Messages;
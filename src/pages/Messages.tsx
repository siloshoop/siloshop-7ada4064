import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { Archive, Loader2, MessageSquare, Package, RotateCcw, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useChatConversations } from "@/hooks/useChatConversations";
import ChatWindow from "@/components/chat/ChatWindow";

/** Enterprise inbox: realtime conversation list + thread pane. */
const Messages = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const { items, loading, reload } = useChatConversations(search, archived);

  const activeId = params.get("c");
  const active = useMemo(() => items.find((c) => c.id === activeId) ?? null, [items, activeId]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("c", id);
    setParams(next, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col" dir="rtl">
      <Navbar />
      <main className="container mx-auto max-w-6xl flex-1 px-2 py-4 sm:px-4">
        <h1 className="mb-3 flex items-center gap-2 text-2xl font-bold">
          <MessageSquare className="h-6 w-6" /> الرسائل
        </h1>

        <div className="grid min-h-[70vh] gap-3 lg:grid-cols-[320px_1fr]">
          {/* Conversation list */}
          <Card className={cn("flex min-h-0 flex-col overflow-hidden", activeId && "hidden lg:flex")}>
            <div className="space-y-2 border-b p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو رقم الطلب..."
                  className="pe-9"
                />
              </div>
              <Tabs value={archived ? "archived" : "active"} onValueChange={(v) => setArchived(v === "archived")}>
                <TabsList className="w-full">
                  <TabsTrigger value="active" className="flex-1">النشطة</TabsTrigger>
                  <TabsTrigger value="archived" className="flex-1">
                    <Archive className="me-1 h-3.5 w-3.5" /> الأرشيف
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : items.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">لا توجد محادثات</p>
              ) : (
                items.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => select(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b p-3 text-start transition-colors hover:bg-accent",
                      c.id === activeId && "bg-accent",
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={c.peer_avatar || undefined} alt={c.peer_name || "مستخدم"} />
                      <AvatarFallback>{(c.peer_name || "؟").charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">{c.peer_name || "مستخدم"}</span>
                        {c.last_message_at && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: ar })}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {c.last_message_preview || "ابدأ المحادثة"}
                      </p>
                      {(c.order_number || c.return_number) && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          {c.return_number ? <RotateCcw className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                          {c.return_number || c.order_number}
                        </span>
                      )}
                    </div>
                    {c.unread_count > 0 && <Badge className="shrink-0">{c.unread_count}</Badge>}
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* Thread */}
          <Card className={cn("min-h-0 overflow-hidden", !activeId && "hidden lg:block")}>
            {activeId ? (
              <ChatWindow
                key={activeId}
                conversationId={activeId}
                peerName={active?.peer_name}
                peerAvatar={active?.peer_avatar}
                isArchived={active?.is_archived}
                onBack={() => {
                  const next = new URLSearchParams(params);
                  next.delete("c");
                  setParams(next, { replace: true });
                }}
                onChanged={reload}
              />
            ) : (
              <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-2 text-muted-foreground">
                <MessageSquare className="h-10 w-10" />
                <p>اختر محادثة لعرض الرسائل</p>
              </div>
            )}
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Messages;

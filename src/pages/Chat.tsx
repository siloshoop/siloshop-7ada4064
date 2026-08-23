import { useEffect, useState } from "react";
import { Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { chatErrorText } from "@/hooks/useChatThread";
import ChatWindow from "@/components/chat/ChatWindow";

interface PeerProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

/** Context-aware chat entry: /chat/:vendorId?product=&order=&return= */
const Chat = () => {
  const { vendorId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const productId = searchParams.get("product");
  const orderId = searchParams.get("order");
  const returnId = searchParams.get("return");

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [peer, setPeer] = useState<PeerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !vendorId) return;
    let active = true;

    const init = async () => {
      setLoading(true);
      const [{ data: profiles }, { data: convId, error: rpcError }] = await Promise.all([
        supabase.rpc("get_vendor_public_info", { vendor_id: vendorId }),
        supabase.rpc("start_conversation", {
          p_vendor_id: vendorId,
          p_product_id: productId ?? undefined,
          p_order_id: orderId ?? undefined,
          p_return_id: returnId ?? undefined,
        }),
      ]);
      if (!active) return;

      if (profiles && profiles.length > 0) setPeer(profiles[0] as PeerProfile);
      if (rpcError) setError(chatErrorText(rpcError.message));
      else setConversationId(convId as string);
      setLoading(false);
    };

    void init();
    return () => {
      active = false;
    };
  }, [user, vendorId, productId, orderId, returnId]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location.pathname + location.search }} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col" dir="rtl">
      <Navbar />
      <main className="container mx-auto max-w-3xl flex-1 px-2 py-4 sm:px-4">
        <Card className="min-h-[75vh] overflow-hidden">
          {loading ? (
            <div className="flex min-h-[75vh] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error || !conversationId ? (
            <div className="flex min-h-[75vh] items-center justify-center p-6 text-center text-sm text-destructive">
              {error || "تعذر بدء المحادثة"}
            </div>
          ) : (
            <div className="h-[75vh]">
              <ChatWindow
                conversationId={conversationId}
                peerName={peer?.full_name}
                peerAvatar={peer?.avatar_url}
              />
            </div>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Chat;

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ChatConversation {
  id: string;
  customer_id: string;
  vendor_id: string;
  product_id: string | null;
  order_id: string | null;
  return_id: string | null;
  context_type: string;
  subject: string | null;
  order_number: string | null;
  return_number: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
  is_blocked: boolean;
  is_suspended: boolean;
  suspended_until: string | null;
  admin_id: string | null;
  unread_count: number;
  is_archived: boolean;
  peer_id: string | null;
  peer_name: string | null;
  peer_avatar: string | null;
  peer_last_seen: string | null;
  my_role: string;
}

/** Realtime inbox: conversations for the signed-in user (customer or seller). */
export const useChatConversations = (search: string, archived: boolean) => {
  const { user } = useAuth();
  const [items, setItems] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc("list_conversations", {
      p_search: search || null,
      p_archived: archived,
      p_limit: 100,
      p_offset: 0,
    });
    setItems((data as ChatConversation[]) || []);
    setLoading(false);
  }, [user, search, archived]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    void load();
  }, [user, load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  return { items, loading, reload: load };
};

/** Total unread messages across active conversations (realtime). */
export const useChatUnreadTotal = () => {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    if (!user) {
      setTotal(0);
      return;
    }
    const { data } = await supabase.rpc("chat_unread_total");
    setTotal(typeof data === "number" ? data : 0);
  }, [user]);

  useEffect(() => {
    void load();
    if (!user) return;
    const channel = supabase
      .channel(`unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  return total;
};

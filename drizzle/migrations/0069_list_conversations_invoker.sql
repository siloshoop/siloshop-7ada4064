CREATE OR REPLACE FUNCTION public.chat_conversation_labels(_conversation_id uuid)
RETURNS TABLE(peer_id uuid, peer_name text, peer_avatar text, peer_last_seen timestamptz, order_number text, return_number text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT peer.id, peer.full_name, peer.avatar_url, peer_cp.last_seen_at, o.order_number, r.return_number
    FROM public.conversations c
    JOIN public.conversation_participants me
      ON me.conversation_id = c.id AND me.user_id = auth.uid()
    LEFT JOIN public.profiles peer
      ON peer.id = CASE WHEN c.customer_id = auth.uid() THEN c.vendor_id ELSE c.customer_id END
    LEFT JOIN public.conversation_participants peer_cp
      ON peer_cp.conversation_id = c.id AND peer_cp.user_id = peer.id
    LEFT JOIN public.orders o ON o.id = c.order_id
    LEFT JOIN public.returns r ON r.id = c.return_id
   WHERE c.id = _conversation_id
     AND auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.chat_conversation_labels(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_conversation_labels(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_conversations(p_search text DEFAULT NULL::text, p_archived boolean DEFAULT false, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, customer_id uuid, vendor_id uuid, product_id uuid, order_id uuid, return_id uuid, context_type text, subject text, order_number text, return_number text, last_message_at timestamp with time zone, last_message_preview text, last_message_sender_id uuid, is_blocked boolean, is_suspended boolean, suspended_until timestamp with time zone, admin_id uuid, unread_count integer, is_archived boolean, peer_id uuid, peer_name text, peer_avatar text, peer_last_seen timestamp with time zone, my_role text)
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT c.id, c.customer_id, c.vendor_id, c.product_id, c.order_id, c.return_id,
         c.context_type, c.subject, l.order_number, l.return_number,
         c.last_message_at, c.last_message_preview, c.last_message_sender_id,
         c.is_blocked, c.is_suspended, c.suspended_until,
         c.admin_id, cp.unread_count, cp.is_archived,
         l.peer_id, l.peer_name, l.peer_avatar, l.peer_last_seen, cp.role
    FROM public.conversations c
    JOIN public.conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = auth.uid()
    LEFT JOIN LATERAL public.chat_conversation_labels(c.id) l ON true
   WHERE cp.is_archived = COALESCE(p_archived, false)
     AND (
       p_search IS NULL OR length(trim(p_search)) = 0
       OR l.peer_name ILIKE '%'||p_search||'%'
       OR l.order_number ILIKE '%'||p_search||'%'
       OR l.return_number ILIKE '%'||p_search||'%'
       OR c.subject ILIKE '%'||p_search||'%'
       OR EXISTS (SELECT 1 FROM public.messages m
                   WHERE m.conversation_id = c.id AND m.content ILIKE '%'||p_search||'%')
     )
   ORDER BY c.last_message_at DESC NULLS LAST
   LIMIT GREATEST(1, LEAST(COALESCE(p_limit,30), 100)) OFFSET GREATEST(0, COALESCE(p_offset,0));
$function$;
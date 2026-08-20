REVOKE EXECUTE ON FUNCTION public.next_order_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.orders_set_numbers() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_order_shipping_details() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_tracking_history() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.order_reports(timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seller_list_orders(text, text, timestamptz, timestamptz, int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_order_note(uuid, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_order_notes(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_order_shipping(uuid, text, text, timestamptz, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.order_reports(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_list_orders(text, text, timestamptz, timestamptz, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_order_note(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_order_notes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_shipping(uuid, text, text, timestamptz, text) TO authenticated;
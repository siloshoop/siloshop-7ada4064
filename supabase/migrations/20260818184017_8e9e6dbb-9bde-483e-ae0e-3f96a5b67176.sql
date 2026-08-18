-- Realtime fix: these tables are published with a restricted column list, but had
-- REPLICA IDENTITY FULL, which requires the publication to cover every column and
-- therefore blocked all DELETEs. Use the primary key (already published) instead.
ALTER TABLE public.order_status_history REPLICA IDENTITY DEFAULT;
ALTER TABLE public.orders REPLICA IDENTITY DEFAULT;
ALTER TABLE public.order_items REPLICA IDENTITY DEFAULT;
ALTER TABLE public.stock_movements REPLICA IDENTITY DEFAULT;

-- AUDIT CLEANUP: remove all isolated test data and restore Phase-2 disabled state
DELETE FROM public.notifications WHERE related_id = '76454280-b3fe-439d-9028-cc65148db3b5';
DELETE FROM public.payment_transactions WHERE order_id = '76454280-b3fe-439d-9028-cc65148db3b5';
DELETE FROM public.payments WHERE order_id = '76454280-b3fe-439d-9028-cc65148db3b5';
DELETE FROM public.order_status_history WHERE order_id = '76454280-b3fe-439d-9028-cc65148db3b5';
DELETE FROM public.order_items WHERE order_id = '76454280-b3fe-439d-9028-cc65148db3b5';
DELETE FROM public.orders WHERE id = '76454280-b3fe-439d-9028-cc65148db3b5';
DELETE FROM public.payment_webhook_events
 WHERE provider = 'sham_cash'
   AND (payload->>'order_id' IS NULL
        OR payload->>'order_id' IN ('76454280-b3fe-439d-9028-cc65148db3b5',
                                    '11111111-1111-4111-8111-111111111111',
                                    '7d030873-30af-4bea-94e6-14a37b2635e2',
                                    'xyz'));
DELETE FROM public.stock_movements WHERE product_id = 'aaaaaaaa-0000-4000-8000-000000000001';
DELETE FROM public.products WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001';

UPDATE public.sham_cash_merchant_config
   SET is_active = false, api_base_url = NULL, callback_url = NULL, updated_at = now()
 WHERE id = 1;
UPDATE public.feature_flags SET enabled = false
 WHERE key IN ('platform_marketplace','sham_cash_payments');
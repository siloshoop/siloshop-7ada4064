-- TEST SETUP (temporary; reverted at end of audit)
UPDATE public.feature_flags SET enabled = true WHERE key IN ('platform_marketplace','sham_cash_payments');
INSERT INTO public.products (id, vendor_id, name, description, price, shipping_cost, stock_quantity, is_active, moderation_status, product_type, currency, sizes, colors, source)
VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'f80ad907-66c6-40df-a02e-d10e9314865c', '[AUDIT TEST] منتج منصة', 'test only', 1000, 0, 5, true, 'approved', 'platform', 'SYP', '{}', '{}', 'manual')
ON CONFLICT (id) DO NOTHING;
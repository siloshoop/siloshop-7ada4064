-- TEST SETUP (temporary; reverted at end of audit)
UPDATE public.sham_cash_merchant_config
   SET is_active = true,
       api_base_url = 'https://sandbox.example.invalid',
       callback_url = 'https://cflrdbkvpzzilazdufmh.functions.supabase.co/sham-cash-webhook',
       environment = 'sandbox',
       updated_at = now()
 WHERE id = 1;
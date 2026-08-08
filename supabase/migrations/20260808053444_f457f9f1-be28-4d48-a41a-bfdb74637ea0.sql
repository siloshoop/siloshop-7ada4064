ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_kind text NOT NULL DEFAULT 'seller',
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cod';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_kind_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_kind_check CHECK (order_kind IN ('seller','platform'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('cod','sham_cash'));

CREATE TABLE IF NOT EXISTS public.platform_payment_settings (
  id integer PRIMARY KEY DEFAULT 1,
  sham_cash_account_name text NOT NULL DEFAULT '',
  sham_cash_account_number text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_payment_settings_singleton CHECK (id = 1)
);

GRANT SELECT ON public.platform_payment_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.platform_payment_settings TO authenticated;
GRANT ALL ON public.platform_payment_settings TO service_role;
ALTER TABLE public.platform_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read platform payment settings" ON public.platform_payment_settings;
CREATE POLICY "Anyone can read platform payment settings"
  ON public.platform_payment_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Super admins manage platform payment settings" ON public.platform_payment_settings;
CREATE POLICY "Super admins manage platform payment settings"
  ON public.platform_payment_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

INSERT INTO public.platform_payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_platform_payment_settings_updated_at ON public.platform_payment_settings;
CREATE TRIGGER trg_platform_payment_settings_updated_at
  BEFORE UPDATE ON public.platform_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Admins can manage platform products" ON public.products;
CREATE POLICY "Super admins can manage platform products"
  ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));
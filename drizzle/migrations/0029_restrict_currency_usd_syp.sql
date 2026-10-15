CREATE OR REPLACE FUNCTION public.enforce_supported_currency()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.currency IS NULL OR NEW.currency NOT IN ('USD','SYP') THEN
    RAISE EXCEPTION 'العملة غير مدعومة: يُسمح فقط بالدولار الأمريكي (USD) أو الليرة السورية (SYP)'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','orders','order_items','coupons','coupon_redemptions','payments','payment_transactions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_supported_currency ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_enforce_supported_currency BEFORE INSERT OR UPDATE OF currency ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_supported_currency()', t);
    IF t <> 'coupons' THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (currency IN (''USD'',''SYP''))', t, t || '_currency_supported');
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.products ALTER COLUMN currency DROP DEFAULT;
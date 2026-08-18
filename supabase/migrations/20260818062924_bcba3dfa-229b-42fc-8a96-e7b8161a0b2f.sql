-- 1. Payment status may never be set by a client. record_payment() let any
--    customer flip their own pending order to "confirmed" with a
--    payment_status='completed' row. Backend/service-role only from now on.
REVOKE EXECUTE ON FUNCTION public.record_payment(uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_payment(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_payment(uuid, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, text, jsonb) TO service_role;

-- Defense in depth: refund status changes are admin-only, anon has no business calling it.
REVOKE EXECUTE ON FUNCTION public.update_refund_status(uuid, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_refund_status(uuid, text, text, text, text) FROM anon;

-- 2. Constrain payment status vocabulary and store provider/failure metadata.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'SYP',
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS failure_reason text;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_valid;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_valid
  CHECK (payment_status IN ('pending','paid','completed','failed','cancelled','refunded'));

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_valid;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_valid
  CHECK (payment_method IN ('cod','cash','sham_cash','syriatel','mtn','card','bank_transfer'));

CREATE INDEX IF NOT EXISTS idx_payments_provider_reference
  ON public.payments (provider_reference);

-- 3. Single, atomic, idempotent settlement path for Sham Cash callbacks.
--    Verifies amount + currency + order kind server-side; a forged or
--    mismatched callback can never mark an order as paid.
CREATE OR REPLACE FUNCTION public.settle_sham_cash_payment(
  _order_id uuid,
  _succeeded boolean,
  _provider_reference text DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _currency text DEFAULT NULL,
  _failure_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _o public.orders%ROWTYPE;
  _cur text := upper(COALESCE(_currency, 'SYP'));
BEGIN
  -- Backend only. EXECUTE is also revoked from anon/authenticated below.
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  IF _o.order_kind <> 'platform' OR _o.payment_method <> 'sham_cash' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_sham_cash_order');
  END IF;

  -- Idempotency: a second identical callback is a no-op.
  IF _succeeded AND _o.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_settled');
  END IF;
  IF NOT _succeeded AND _o.payment_status = 'failed' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_failed');
  END IF;
  IF _o.payment_status IN ('paid','refunded') AND NOT _succeeded THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cannot_fail_a_paid_order');
  END IF;

  IF _succeeded THEN
    -- Amount / currency must match the server-side order total exactly.
    IF _amount IS NULL OR round(_amount, 2) <> round(_o.total_amount, 2) THEN
      UPDATE public.payment_transactions
         SET status = 'failed', failure_reason = 'amount_mismatch', updated_at = now()
       WHERE order_id = _order_id AND provider = 'sham_cash';
      RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
    END IF;
    IF _cur <> 'SYP' THEN
      UPDATE public.payment_transactions
         SET status = 'failed', failure_reason = 'currency_mismatch', updated_at = now()
       WHERE order_id = _order_id AND provider = 'sham_cash';
      RETURN jsonb_build_object('ok', false, 'reason', 'currency_mismatch');
    END IF;

    UPDATE public.payment_transactions
       SET status = 'succeeded', provider_reference = COALESCE(_provider_reference, provider_reference),
           failure_reason = NULL, updated_at = now()
     WHERE order_id = _order_id AND provider = 'sham_cash';

    UPDATE public.payments
       SET payment_status = 'paid',
           currency = 'SYP',
           provider_reference = COALESCE(_provider_reference, provider_reference),
           failure_reason = NULL,
           payment_details = COALESCE(payment_details, '{}'::jsonb)
             || jsonb_build_object('settled_at', now(), 'provider', 'sham_cash'),
           updated_at = now()
     WHERE order_id = _order_id AND payment_status NOT IN ('paid','refunded');

    UPDATE public.orders
       SET payment_status = 'paid',
           status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
           updated_at = now()
     WHERE id = _order_id;

    -- One history row and one notification per settlement.
    IF NOT EXISTS (
      SELECT 1 FROM public.order_status_history
       WHERE order_id = _order_id AND notes = 'تم تأكيد الدفع عبر شام كاش'
    ) THEN
      INSERT INTO public.order_status_history
        (order_id, status, from_status, notes, changed_by_role, is_override)
      VALUES (_order_id, 'confirmed', _o.status, 'تم تأكيد الدفع عبر شام كاش', 'system', false);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
       WHERE user_id = _o.customer_id AND related_id = _order_id AND type = 'payment_paid'
    ) THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      VALUES (_o.customer_id, 'تم تأكيد الدفع',
              'تم تأكيد دفع طلبك عبر شام كاش بنجاح.', 'payment_paid', _order_id);
    END IF;

    RETURN jsonb_build_object('ok', true, 'status', 'paid');
  END IF;

  -- Failure / cancellation path: never treated as success.
  UPDATE public.payment_transactions
     SET status = 'failed', failure_reason = COALESCE(_failure_reason, 'provider_failure'),
         provider_reference = COALESCE(_provider_reference, provider_reference), updated_at = now()
   WHERE order_id = _order_id AND provider = 'sham_cash';

  UPDATE public.payments
     SET payment_status = 'failed',
         failure_reason = COALESCE(_failure_reason, 'provider_failure'),
         updated_at = now()
   WHERE order_id = _order_id AND payment_status NOT IN ('paid','refunded');

  UPDATE public.orders SET payment_status = 'failed', updated_at = now() WHERE id = _order_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
     WHERE user_id = _o.customer_id AND related_id = _order_id AND type = 'payment_failed'
  ) THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (_o.customer_id, 'فشل الدفع',
            'لم يكتمل الدفع عبر شام كاش. يمكنك المحاولة مرة أخرى.', 'payment_failed', _order_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'failed');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_sham_cash_payment(uuid, boolean, text, numeric, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.settle_sham_cash_payment(uuid, boolean, text, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.settle_sham_cash_payment(uuid, boolean, text, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_sham_cash_payment(uuid, boolean, text, numeric, text, text) TO service_role;
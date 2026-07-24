
-- Admin Order Management RPCs (Phase 3)

-- Paginated, filtered list of orders for admins/moderators
CREATE OR REPLACE FUNCTION public.admin_list_orders(
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,
  _payment_status text DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit int DEFAULT 50,
  _offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  status text,
  payment_status text,
  total_amount numeric,
  discount_amount numeric,
  coupon_code text,
  phone text,
  shipping_address text,
  tracking_number text,
  courier_name text,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  customer_id uuid,
  customer_name text,
  customer_email text,
  items_count bigint,
  vendors_count bigint,
  total_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT o.*
    FROM public.orders o
    WHERE public.has_any_admin_role(auth.uid())
      AND (_status IS NULL OR o.status = _status)
      AND (_payment_status IS NULL OR o.payment_status = _payment_status)
      AND (_from IS NULL OR o.created_at >= _from)
      AND (_to IS NULL OR o.created_at <= _to)
      AND (
        _search IS NULL OR length(trim(_search)) = 0
        OR o.id::text ILIKE '%' || _search || '%'
        OR COALESCE(o.phone,'') ILIKE '%' || _search || '%'
        OR COALESCE(o.tracking_number,'') ILIKE '%' || _search || '%'
        OR COALESCE(o.coupon_code,'') ILIKE '%' || _search || '%'
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = o.customer_id AND COALESCE(p.full_name,'') ILIKE '%' || _search || '%')
        OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = o.customer_id AND COALESCE(u.email,'') ILIKE '%' || _search || '%')
      )
  ), counted AS (
    SELECT (SELECT count(*) FROM base) AS tc
  )
  SELECT
    b.id, b.created_at, b.updated_at, b.status, b.payment_status,
    b.total_amount, b.discount_amount, b.coupon_code, b.phone,
    b.shipping_address, b.tracking_number, b.courier_name,
    b.delivered_at, b.cancelled_at, b.cancellation_reason,
    b.customer_id,
    p.full_name AS customer_name,
    u.email AS customer_email,
    (SELECT count(*) FROM public.order_items oi WHERE oi.order_id = b.id) AS items_count,
    (SELECT count(DISTINCT oi.vendor_id) FROM public.order_items oi WHERE oi.order_id = b.id) AS vendors_count,
    (SELECT tc FROM counted) AS total_count
  FROM base b
  LEFT JOIN public.profiles p ON p.id = b.customer_id
  LEFT JOIN auth.users u ON u.id = b.customer_id
  ORDER BY b.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200))
  OFFSET GREATEST(0, _offset);
$$;

-- Full order detail (items, payments, timeline, customer, vendors)
CREATE OR REPLACE FUNCTION public.admin_get_order_detail(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order jsonb;
  _items jsonb;
  _payments jsonb;
  _timeline jsonb;
  _customer jsonb;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT to_jsonb(o.*) INTO _order FROM public.orders o WHERE o.id = _order_id;
  IF _order IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', oi.id, 'product_id', oi.product_id, 'vendor_id', oi.vendor_id,
    'quantity', oi.quantity, 'price', oi.price,
    'product_name', pr.name, 'product_image', COALESCE(pr.image_url, (pr.images->>0)),
    'vendor_name', vp.full_name
  ) ORDER BY oi.created_at), '[]'::jsonb) INTO _items
  FROM public.order_items oi
  LEFT JOIN public.products pr ON pr.id = oi.product_id
  LEFT JOIN public.profiles vp ON vp.id = oi.vendor_id
  WHERE oi.order_id = _order_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at), '[]'::jsonb) INTO _payments
  FROM public.payments p WHERE p.order_id = _order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', h.id, 'status', h.status, 'notes', h.notes, 'created_at', h.created_at
  ) ORDER BY h.created_at), '[]'::jsonb) INTO _timeline
  FROM public.order_status_history h WHERE h.order_id = _order_id;

  SELECT jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'phone', p.phone, 'avatar_url', p.avatar_url,
    'email', u.email, 'account_status', p.account_status
  ) INTO _customer
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id = (_order->>'customer_id')::uuid;

  RETURN jsonb_build_object(
    'order', _order,
    'items', _items,
    'payments', _payments,
    'timeline', _timeline,
    'customer', _customer
  );
END;
$$;

-- Admin update status (any transition, records history)
CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  _order_id uuid,
  _status text,
  _tracking_number text DEFAULT NULL,
  _courier_name text DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _customer uuid; _old text;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _status NOT IN ('pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT status, customer_id INTO _old, _customer FROM public.orders WHERE id = _order_id;
  IF _customer IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;

  UPDATE public.orders
     SET status = _status,
         tracking_number = COALESCE(_tracking_number, tracking_number),
         courier_name = COALESCE(_courier_name, courier_name),
         delivered_at = CASE WHEN _status = 'delivered' AND delivered_at IS NULL THEN now() ELSE delivered_at END,
         updated_at = now()
   WHERE id = _order_id;

  INSERT INTO public.order_status_history (order_id, status, notes)
  VALUES (_order_id, _status, _note);

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_customer, 'تحديث حالة الطلب',
          'تم تحديث حالة طلبك إلى: ' || _status || COALESCE(' — ' || _note, ''),
          'order_status', _order_id);
END;
$$;

-- Admin cancel order (any state except delivered/cancelled)
CREATE OR REPLACE FUNCTION public.admin_cancel_order(_order_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _o public.orders%ROWTYPE;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF _o.status IN ('delivered','cancelled') THEN RAISE EXCEPTION 'order_not_cancellable'; END IF;

  UPDATE public.orders
     SET status = 'cancelled',
         cancellation_reason = _reason,
         cancelled_at = now(),
         cancelled_by = auth.uid(),
         cancelled_by_role = 'admin',
         updated_at = now()
   WHERE id = _order_id;

  INSERT INTO public.order_status_history (order_id, status, notes)
  VALUES (_order_id, 'cancelled', _reason);

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_o.customer_id, 'تم إلغاء طلبك من قبل الإدارة',
          'السبب: ' || _reason, 'order_cancelled', _order_id);
END;
$$;

-- Admin refund order (marks payments refunded, notifies customer)
CREATE OR REPLACE FUNCTION public.admin_refund_order(_order_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _o public.orders%ROWTYPE;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  UPDATE public.payments
     SET payment_status = 'refunded',
         payment_details = COALESCE(payment_details,'{}'::jsonb) ||
                           jsonb_build_object('refund_reason', _reason,
                                              'refunded_at', now(),
                                              'refunded_by', auth.uid()),
         updated_at = now()
   WHERE order_id = _order_id
     AND payment_status <> 'refunded';

  UPDATE public.orders
     SET payment_status = 'refunded', updated_at = now()
   WHERE id = _order_id;

  INSERT INTO public.order_status_history (order_id, status, notes)
  VALUES (_order_id, COALESCE(_o.status,'refunded'), 'refund: ' || _reason);

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_o.customer_id, 'تم استرداد مبلغ طلبك',
          'تم استرداد مبلغ الطلب. السبب: ' || _reason, 'order_refunded', _order_id);
END;
$$;

-- Customer/seller quick history for admin drawer
CREATE OR REPLACE FUNCTION public.admin_user_order_history(_user_id uuid, _limit int DEFAULT 20)
RETURNS TABLE(id uuid, created_at timestamptz, status text, total_amount numeric, role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.created_at, o.status, o.total_amount, 'customer'::text AS role
  FROM public.orders o
  WHERE public.has_any_admin_role(auth.uid()) AND o.customer_id = _user_id
  UNION ALL
  SELECT o.id, o.created_at, o.status, o.total_amount, 'seller'::text AS role
  FROM public.orders o
  WHERE public.has_any_admin_role(auth.uid())
    AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.vendor_id = _user_id)
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100));
$$;

-- Helpful indexes for the admin filters
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON public.orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_vendor ON public.order_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_created ON public.order_status_history(order_id, created_at);

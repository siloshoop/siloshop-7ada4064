-- Status labels helper
CREATE OR REPLACE FUNCTION public.return_status_label(_status text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE((jsonb_build_object(
    'pending_review','بانتظار المراجعة',
    'seller_reviewing','البائع يراجع الطلب',
    'waiting_customer','بانتظار رد المشتري',
    'approved','تمت الموافقة',
    'rejected','مرفوض',
    'customer_shipping','المشتري أرسل المنتج',
    'seller_inspecting','البائع يفحص المنتج',
    'inspection_passed','نجح الفحص',
    'inspection_failed','فشل الفحص',
    'completed','مكتمل',
    'cancelled','ملغي'
  ))->>_status, _status);
$$;

-- Email helper (best effort, never blocks the transaction)
CREATE OR REPLACE FUNCTION public.return_enqueue_email(_user_id uuid, _subject text, _heading text, _body text, _label text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _mid uuid := gen_random_uuid(); _html text;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  SELECT u.email INTO _email FROM auth.users u WHERE u.id = _user_id;
  IF _email IS NULL OR _email = '' THEN RETURN; END IF;

  _html := '<!doctype html><html dir="rtl" lang="ar"><body style="font-family:Tahoma,Arial,sans-serif;background:#f7f7fb;padding:24px">'
        || '<div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;padding:24px;border:1px solid #ececf5">'
        || '<h2 style="color:#6d28d9;margin:0 0 12px">' || _heading || '</h2>'
        || '<p style="color:#333;line-height:1.8;font-size:15px;margin:0 0 16px">' || _body || '</p>'
        || '<a href="https://siloshop.net/my-returns" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px">متابعة طلب الإرجاع</a>'
        || '<p style="color:#888;font-size:12px;margin-top:20px">siloshop — إدارة المرتجعات</p></div></body></html>';

  BEGIN
    INSERT INTO public.email_send_log (message_id, template_name, recipient_email, status)
    VALUES (_mid, COALESCE(_label,'return_update'), _email, 'pending');

    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'message_id', _mid,
      'to', _email,
      'from', 'siloshop <noreply@notify.siloshop.net>',
      'sender_domain', 'notify.siloshop.net',
      'subject', _subject,
      'html', _html,
      'purpose', 'transactional',
      'label', COALESCE(_label,'return_update'),
      'queued_at', now()
    ));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'return_enqueue_email failed: %', SQLERRM;
  END;
END; $$;
REVOKE ALL ON FUNCTION public.return_enqueue_email(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.return_enqueue_email(uuid, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.return_enqueue_email(uuid, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.return_enqueue_email(uuid, text, text, text, text) TO service_role;

-- Timeline + notifications trigger
CREATE OR REPLACE FUNCTION public.returns_status_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _role text := COALESCE(NULLIF(current_setting('app.return_actor_role', true), ''), NEW.last_actor_role, 'system');
  _note text := NULLIF(current_setting('app.return_note', true), '');
  _label text := public.return_status_label(NEW.status);
  _msg text;
  _uid uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.return_status_history (return_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (NEW.id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END, NEW.status, _actor, _role, _note);

  _msg := 'طلب الإرجاع ' || COALESCE(NEW.return_number, left(NEW.id::text, 8))
       || ' — الحالة الآن: ' || _label
       || COALESCE(' — ' || _note, '');

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (NEW.customer_id, CASE WHEN TG_OP = 'INSERT' THEN 'تم إرسال طلب الإرجاع' ELSE 'تحديث طلب الإرجاع' END, _msg, 'return_status', NEW.id);

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (NEW.vendor_id, CASE WHEN TG_OP = 'INSERT' THEN 'طلب إرجاع جديد' ELSE 'تحديث طلب إرجاع' END, _msg,
          CASE WHEN TG_OP = 'INSERT' THEN 'return_created' ELSE 'return_status' END, NEW.id);

  IF TG_OP = 'INSERT' OR NEW.status IN ('rejected','completed','cancelled','inspection_failed') OR _role = 'admin' THEN
    FOR _uid IN SELECT DISTINCT ur.user_id FROM public.user_roles ur
                WHERE ur.role IN ('admin'::public.app_role,'super_admin'::public.app_role)
                  AND ur.user_id NOT IN (NEW.customer_id, NEW.vendor_id)
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      VALUES (_uid, 'متابعة إدارية لطلب إرجاع', _msg, 'return_status', NEW.id);
    END LOOP;
  END IF;

  -- Emails on key milestones
  IF TG_OP = 'INSERT' OR NEW.status IN ('approved','rejected','waiting_customer','inspection_passed','inspection_failed','completed','customer_shipping','seller_inspecting') THEN
    PERFORM public.return_enqueue_email(NEW.customer_id, 'تحديث طلب الإرجاع ' || COALESCE(NEW.return_number,''), _label, _msg, 'return_' || NEW.status);
    IF TG_OP = 'INSERT' OR NEW.status IN ('customer_shipping','cancelled') OR _role IN ('admin','customer') THEN
      PERFORM public.return_enqueue_email(NEW.vendor_id, 'تحديث طلب إرجاع ' || COALESCE(NEW.return_number,''), _label, _msg, 'return_' || NEW.status);
    END IF;
  END IF;

  -- COD refund coordination flag on the order
  IF NEW.status IN ('approved','inspection_passed') THEN
    UPDATE public.orders SET refund_status = 'pending', updated_at = now()
     WHERE id = NEW.order_id AND COALESCE(refund_status,'none') = 'none';
  END IF;

  INSERT INTO public.activity_logs (user_id, action_type, action_details)
  VALUES (COALESCE(_actor, NEW.customer_id),
          CASE WHEN TG_OP = 'INSERT' THEN 'return_created' ELSE 'return_status_changed' END,
          jsonb_build_object('return_id', NEW.id, 'return_number', NEW.return_number,
                             'status', NEW.status, 'role', _role, 'note', _note));

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_returns_status_event ON public.returns;
CREATE TRIGGER trg_returns_status_event AFTER INSERT OR UPDATE OF status ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.returns_status_event();
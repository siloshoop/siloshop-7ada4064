CREATE TABLE public.seller_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  reason_code text NOT NULL,
  reason text,
  related_type text,
  related_id uuid,
  issued_by uuid,
  status text NOT NULL DEFAULT 'active',
  revoked_by uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_violations_severity_chk CHECK (severity IN ('warning','strike','suspension')),
  CONSTRAINT seller_violations_status_chk CHECK (status IN ('active','revoked'))
);

CREATE INDEX seller_violations_vendor_idx ON public.seller_violations (vendor_id, status);

GRANT SELECT ON public.seller_violations TO authenticated;
GRANT ALL ON public.seller_violations TO service_role;

ALTER TABLE public.seller_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own violations"
ON public.seller_violations FOR SELECT TO authenticated
USING (auth.uid() = vendor_id);

CREATE POLICY "Admin roles can view all violations"
ON public.seller_violations FOR SELECT TO authenticated
USING (public.has_any_admin_role(auth.uid()));

CREATE TRIGGER seller_violations_updated_at
BEFORE UPDATE ON public.seller_violations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.admin_issue_violation(
  _vendor_id uuid,
  _severity text,
  _reason_code text,
  _reason text DEFAULT NULL,
  _related_type text DEFAULT NULL,
  _related_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _active_count int;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _severity NOT IN ('warning','strike','suspension') THEN RAISE EXCEPTION 'invalid_severity'; END IF;
  IF _reason_code IS NULL OR btrim(_reason_code) = '' THEN RAISE EXCEPTION 'reason_code_required'; END IF;

  INSERT INTO public.seller_violations (vendor_id, severity, reason_code, reason, related_type, related_id, issued_by)
  VALUES (_vendor_id, _severity, _reason_code, _reason, _related_type, _related_id, auth.uid())
  RETURNING id INTO _id;

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (
    _vendor_id,
    CASE _severity
      WHEN 'warning' THEN 'إنذار من الإدارة'
      WHEN 'strike' THEN 'تم تسجيل مخالفة على حسابك'
      ELSE 'تم إيقاف حسابك كبائع'
    END,
    _reason_code || COALESCE(' — ' || _reason, ''),
    'seller_violation',
    _id
  );

  SELECT count(*) INTO _active_count
  FROM public.seller_violations
  WHERE vendor_id = _vendor_id AND status = 'active' AND severity IN ('strike','suspension');

  IF _severity = 'suspension' OR _active_count >= 3 THEN
    PERFORM public.suspend_seller(_vendor_id, COALESCE(_reason, _reason_code));
  END IF;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_violation(_violation_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _v public.seller_violations%ROWTYPE;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  UPDATE public.seller_violations
     SET status = 'revoked', revoked_by = auth.uid(), revoked_at = now(), updated_at = now()
   WHERE id = _violation_id AND status = 'active'
  RETURNING * INTO _v;

  IF NOT FOUND THEN RAISE EXCEPTION 'violation_not_found'; END IF;

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (_v.vendor_id, 'تم إلغاء مخالفة', COALESCE(_note, 'تم إلغاء مخالفة مسجلة على حسابك: ' || _v.reason_code), 'seller_violation_revoked', _v.id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_issue_violation(uuid, text, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_violation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_issue_violation(uuid, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_violation(uuid, text) TO authenticated;
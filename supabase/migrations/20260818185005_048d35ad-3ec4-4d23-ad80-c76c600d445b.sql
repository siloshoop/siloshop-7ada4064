-- 1. Role hierarchy: super_admin ⊇ admin ⊇ moderator
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (
        ur.role = _role
        OR (ur.role = 'super_admin'::app_role AND _role IN ('admin'::app_role,'moderator'::app_role))
        OR (ur.role = 'admin'::app_role AND _role = 'moderator'::app_role)
      )
  )
$$;

-- 2. Admin read-only visibility on payments (writes stay blocked by existing false policies)
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
CREATE POLICY "Admins can view all payments"
  ON public.payments FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

-- 3. Admins can read role assignments
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

-- 4. Remove blanket admin profile UPDATE (audited RPCs replace it)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- 5. Centralized append-only admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON public.admin_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON public.admin_audit_log (target_type, target_id);

CREATE OR REPLACE FUNCTION public.actor_admin_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.role::text
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
    AND ur.role IN ('super_admin'::app_role,'admin'::app_role,'moderator'::app_role)
  ORDER BY CASE ur.role
             WHEN 'super_admin'::app_role THEN 1
             WHEN 'admin'::app_role THEN 2
             ELSE 3 END
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text,
  _target_type text,
  _target_id uuid,
  _old_value jsonb DEFAULT NULL,
  _new_value jsonb DEFAULT NULL,
  _reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, actor_role, action, target_type, target_id, old_value, new_value, reason)
  VALUES (auth.uid(), public.actor_admin_role(auth.uid()), _action, _target_type, _target_id, _old_value, _new_value, _reason);
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_action(text,text,uuid,jsonb,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text,text,uuid,jsonb,jsonb,text) TO authenticated, service_role;

-- Generic trigger: record any admin-performed change with a field-level diff
CREATE OR REPLACE FUNCTION public.audit_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _old jsonb;
  _new jsonb;
  _diff_old jsonb := '{}'::jsonb;
  _diff_new jsonb := '{}'::jsonb;
  _k text;
  _target uuid;
BEGIN
  IF _actor IS NULL OR NOT public.has_any_admin_role(_actor) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD); _new := to_jsonb(NEW);
    FOR _k IN SELECT jsonb_object_keys(_new) LOOP
      IF (_new -> _k) IS DISTINCT FROM (_old -> _k) THEN
        _diff_old := _diff_old || jsonb_build_object(_k, _old -> _k);
        _diff_new := _diff_new || jsonb_build_object(_k, _new -> _k);
      END IF;
    END LOOP;
    IF _diff_new = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    _diff_new := to_jsonb(NEW);
  ELSE
    _diff_old := to_jsonb(OLD);
  END IF;

  BEGIN
    _target := (COALESCE(to_jsonb(NEW), to_jsonb(OLD)) ->> 'id')::uuid;
  EXCEPTION WHEN others THEN _target := NULL;
  END;

  INSERT INTO public.admin_audit_log (actor_id, actor_role, action, target_type, target_id, old_value, new_value)
  VALUES (
    _actor,
    public.actor_admin_role(_actor),
    lower(TG_OP) || '_' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    _target,
    NULLIF(_diff_old, '{}'::jsonb),
    NULLIF(_diff_new, '{}'::jsonb)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','user_roles','products','orders','showroom_items','reports',
    'announcements','messages','conversations','returns','seller_applications',
    'categories','brands','native_ads','feature_flags'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_admin_%1$s ON public.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_admin_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change()', t);
  END LOOP;
END $$;

-- 6. Role management (super_admin only, audited)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  _user_id uuid,
  _role app_role,
  _grant boolean,
  _reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_target_self';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;

  PERFORM public.log_admin_action(
    CASE WHEN _grant THEN 'role_granted' ELSE 'role_revoked' END,
    'user_roles', _user_id, NULL,
    jsonb_build_object('role', _role::text), _reason);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid,app_role,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid,app_role,boolean,text) TO authenticated, service_role;

-- 7. Remove leftover public/anon EXECUTE on seller lifecycle functions
REVOKE ALL ON FUNCTION public.approve_seller_application(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_seller_application(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.suspend_seller(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_seller(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_seller_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_seller_application(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_seller_application(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.suspend_seller(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_seller(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_seller_account(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.has_any_admin_role(uuid) FROM anon;
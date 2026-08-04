CREATE TABLE public.showroom_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_item_id uuid,
  item_title text,
  action text NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  old_values jsonb,
  new_values jsonb,
  performed_by uuid,
  performed_by_role text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.showroom_audit_log TO authenticated;
GRANT ALL ON public.showroom_audit_log TO service_role;

ALTER TABLE public.showroom_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view showroom audit log"
ON public.showroom_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_showroom_audit_log_created_at ON public.showroom_audit_log (created_at DESC);
CREATE INDEX idx_showroom_audit_log_item ON public.showroom_audit_log (showroom_item_id);

CREATE OR REPLACE FUNCTION public.log_showroom_item_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_fields text[] := '{}';
  v_role text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'super_admin') THEN 'super_admin'
    WHEN public.has_role(auth.uid(), 'admin') THEN 'admin'
    ELSE 'unknown'
  END INTO v_role;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old := to_jsonb(OLD);
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);

    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      v_fields := v_fields || 'is_active';
    END IF;
    IF NEW.is_pinned IS DISTINCT FROM OLD.is_pinned THEN
      v_fields := v_fields || 'is_pinned';
    END IF;
    IF NEW.display_order IS DISTINCT FROM OLD.display_order THEN
      v_fields := v_fields || 'display_order';
    END IF;
    IF NEW.start_date IS DISTINCT FROM OLD.start_date THEN
      v_fields := v_fields || 'start_date';
    END IF;
    IF NEW.end_date IS DISTINCT FROM OLD.end_date THEN
      v_fields := v_fields || 'end_date';
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      v_fields := v_fields || 'priority';
    END IF;
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      v_fields := v_fields || 'title';
    END IF;

    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      v_action := CASE WHEN NEW.is_active THEN 'publish' ELSE 'unpublish' END;
    ELSIF NEW.is_pinned IS DISTINCT FROM OLD.is_pinned THEN
      v_action := CASE WHEN NEW.is_pinned THEN 'pin' ELSE 'unpin' END;
    ELSIF NEW.display_order IS DISTINCT FROM OLD.display_order THEN
      v_action := 'reorder';
    ELSIF NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.end_date IS DISTINCT FROM OLD.end_date THEN
      v_action := 'schedule';
    ELSE
      v_action := 'update';
    END IF;
  END IF;

  INSERT INTO public.showroom_audit_log (
    showroom_item_id, item_title, action, changed_fields,
    old_values, new_values, performed_by, performed_by_role
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.title, OLD.title),
    v_action,
    v_fields,
    v_old,
    v_new,
    auth.uid(),
    v_role
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_log_showroom_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.showroom_items
FOR EACH ROW EXECUTE FUNCTION public.log_showroom_item_change();
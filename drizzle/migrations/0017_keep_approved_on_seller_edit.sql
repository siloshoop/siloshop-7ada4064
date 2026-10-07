CREATE OR REPLACE FUNCTION public.enforce_product_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin boolean;
BEGIN
  v_admin := auth.uid() IS NOT NULL AND public.has_any_admin_role(auth.uid());
  IF v_admin OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.moderation_status IS NULL OR NEW.moderation_status NOT IN ('draft', 'pending') THEN
      NEW.moderation_status := 'pending';
    END IF;
    NEW.moderated_by := NULL;
    NEW.moderated_at := NULL;
    NEW.moderation_reason := NULL;
    NEW.moderation_reason_code := NULL;
    NEW.is_featured := false;
    NEW.is_trending := false;
    NEW.is_recommended := false;
    NEW.is_active := false;
    RETURN NEW;
  END IF;

  NEW.moderated_by := OLD.moderated_by;
  NEW.moderated_at := OLD.moderated_at;
  NEW.moderation_reason_code := OLD.moderation_reason_code;
  NEW.is_featured := OLD.is_featured;
  NEW.is_trending := OLD.is_trending;
  NEW.is_recommended := OLD.is_recommended;

  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    IF NOT (
      (OLD.moderation_status IN ('draft', 'rejected') AND NEW.moderation_status = 'pending')
      OR NEW.moderation_status = 'archived'
      OR (OLD.moderation_status = 'archived' AND NEW.moderation_status = 'draft')
    ) THEN
      RAISE EXCEPTION 'moderation_status_change_not_allowed';
    END IF;
    IF NEW.moderation_status = 'pending' THEN
      NEW.moderation_reason := NULL;
    END IF;
  ELSE
    NEW.moderation_reason := OLD.moderation_reason;
  END IF;

  -- Products approved once stay approved after seller edits (no re-review).

  IF NEW.moderation_status <> 'approved' THEN
    NEW.is_active := false;
  END IF;

  RETURN NEW;
END;
$function$;
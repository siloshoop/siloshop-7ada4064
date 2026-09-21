ALTER TABLE public.product_moderation_log DROP CONSTRAINT IF EXISTS product_moderation_log_action_check;
ALTER TABLE public.product_moderation_log ADD CONSTRAINT product_moderation_log_action_check
  CHECK (action = ANY (ARRAY['approve','reject','hide','restore','suspend','delete','edit','submit']));

CREATE OR REPLACE FUNCTION public.enforce_product_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin boolean;
  v_material boolean;
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

  IF OLD.moderation_status = 'approved' AND NEW.moderation_status = 'approved' THEN
    v_material :=
         (NEW.name IS DISTINCT FROM OLD.name)
      OR (NEW.name_en IS DISTINCT FROM OLD.name_en)
      OR (NEW.description IS DISTINCT FROM OLD.description)
      OR (NEW.short_description IS DISTINCT FROM OLD.short_description)
      OR (NEW.price IS DISTINCT FROM OLD.price)
      OR (NEW.image_url IS DISTINCT FROM OLD.image_url)
      OR (NEW.images IS DISTINCT FROM OLD.images)
      OR (NEW.video_url IS DISTINCT FROM OLD.video_url)
      OR (NEW.category_id IS DISTINCT FROM OLD.category_id)
      OR (NEW.subcategory_id IS DISTINCT FROM OLD.subcategory_id)
      OR (NEW.brand_id IS DISTINCT FROM OLD.brand_id);

    IF v_material THEN
      NEW.moderation_status := 'pending';
      NEW.moderation_reason := NULL;
      NEW.moderation_reason_code := NULL;

      INSERT INTO public.product_moderation_log
        (product_id, action, reason, performed_by, from_status, to_status)
      VALUES
        (NEW.id, 'edit', 'تعديل جوهري من البائع على منتج معتمد — أعيد إلى قيد المراجعة',
         auth.uid(), 'approved', 'pending');
    END IF;
  END IF;

  IF NEW.moderation_status <> 'approved' THEN
    NEW.is_active := false;
  END IF;

  RETURN NEW;
END;
$$;
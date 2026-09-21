-- Per-product "Preview Only" switch (Super Admin only).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.products.purchase_enabled IS
  'false = preview only: product stays visible but cannot be added to cart or ordered. Only super_admin may change it.';

-- 1) Only super_admin (or service_role) may flip the flag; sellers can never touch it.
CREATE OR REPLACE FUNCTION public.enforce_product_purchase_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_privileged boolean;
BEGIN
  v_privileged := coalesce(auth.role(), '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'super_admin'));

  IF TG_OP = 'INSERT' THEN
    IF NOT v_privileged THEN
      NEW.purchase_enabled := true;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.purchase_enabled IS DISTINCT FROM OLD.purchase_enabled AND NOT v_privileged THEN
    RAISE EXCEPTION 'purchase_flag_change_not_allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_enforce_product_purchase_flag ON public.products;
CREATE TRIGGER zz_enforce_product_purchase_flag
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_purchase_flag();

-- 2) Block adding a preview-only product to the cart, even through the API directly.
CREATE OR REPLACE FUNCTION public.block_preview_only_cart_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT p.name INTO v_name
    FROM public.products p
   WHERE p.id = NEW.product_id
     AND p.purchase_enabled IS NOT TRUE;

  IF v_name IS NOT NULL THEN
    RAISE EXCEPTION 'PREVIEW_ONLY:%', v_name;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_preview_only_cart_item ON public.cart_items;
CREATE TRIGGER block_preview_only_cart_item
  BEFORE INSERT OR UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.block_preview_only_cart_item();

-- 3) Block ordering a preview-only product (covers create_order and any direct write path).
CREATE OR REPLACE FUNCTION public.block_preview_only_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT p.name INTO v_name
    FROM public.products p
   WHERE p.id = NEW.product_id
     AND p.purchase_enabled IS NOT TRUE;

  IF v_name IS NOT NULL THEN
    RAISE EXCEPTION 'PREVIEW_ONLY:%', v_name;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_preview_only_order_item ON public.order_items;
CREATE TRIGGER block_preview_only_order_item
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.block_preview_only_order_item();

-- 4) Super-admin RPC to toggle the flag, audited.
CREATE OR REPLACE FUNCTION public.admin_set_product_purchase_enabled(_product_id uuid, _enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF _enabled IS NULL THEN
    RAISE EXCEPTION 'invalid_value';
  END IF;

  SELECT p.purchase_enabled INTO v_old FROM public.products p WHERE p.id = _product_id;
  IF v_old IS NULL AND NOT EXISTS (SELECT 1 FROM public.products WHERE id = _product_id) THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;

  UPDATE public.products
     SET purchase_enabled = _enabled,
         updated_at = now()
   WHERE id = _product_id;

  -- A preview-only product must not linger in anyone's cart.
  IF _enabled IS FALSE THEN
    DELETE FROM public.cart_items WHERE product_id = _product_id;
  END IF;

  INSERT INTO public.admin_audit_log
    (actor_id, actor_role, action, target_type, target_id, old_value, new_value)
  VALUES
    (auth.uid(), public.actor_admin_role(auth.uid()), 'product_purchase_flag_changed', 'product', _product_id,
     jsonb_build_object('purchase_enabled', v_old),
     jsonb_build_object('purchase_enabled', _enabled));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_product_purchase_enabled(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_product_purchase_enabled(uuid, boolean) TO authenticated, service_role;
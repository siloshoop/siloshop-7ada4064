CREATE OR REPLACE FUNCTION public.normalize_variant_product_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = NEW.id) THEN
    SELECT COALESCE(sum(stock_quantity) FILTER (WHERE is_active),0)::integer INTO NEW.stock_quantity FROM public.product_variants WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.normalize_variant_product_stock() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER zz_normalize_variant_product_stock BEFORE UPDATE OF stock_quantity ON public.products FOR EACH ROW EXECUTE FUNCTION public.normalize_variant_product_stock();

CREATE OR REPLACE FUNCTION public.sync_variant_stock_availability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; previous_pid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN pid := OLD.product_id; ELSE pid := NEW.product_id; END IF;
  IF TG_OP = 'UPDATE' AND OLD.product_id <> NEW.product_id THEN previous_pid := OLD.product_id; END IF;
  UPDATE public.products p SET stock_quantity = (SELECT COALESCE(sum(v.stock_quantity) FILTER (WHERE v.is_active),0)::integer FROM public.product_variants v WHERE v.product_id=p.id) WHERE p.id=pid;
  IF previous_pid IS NOT NULL THEN
    UPDATE public.products p SET stock_quantity=(SELECT COALESCE(sum(v.stock_quantity) FILTER (WHERE v.is_active),0)::integer FROM public.product_variants v WHERE v.product_id=p.id) WHERE p.id=previous_pid;
  END IF;
  DELETE FROM public.cart_items c WHERE c.product_id=pid AND c.variant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.product_variants v WHERE v.id=c.variant_id AND v.product_id=pid AND v.is_active AND v.stock_quantity>0);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_variant_stock_availability() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_variant_stock_availability AFTER INSERT OR UPDATE OF stock_quantity, is_active, product_id OR DELETE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.sync_variant_stock_availability();

CREATE OR REPLACE FUNCTION public.remove_sold_out_saved_items()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stock_quantity <= 0 THEN
    DELETE FROM public.cart_items WHERE product_id=NEW.id;
    DELETE FROM public.favorites WHERE product_id=NEW.id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_sold_out_saved_items() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER remove_sold_out_saved_items AFTER UPDATE OF stock_quantity ON public.products FOR EACH ROW EXECUTE FUNCTION public.remove_sold_out_saved_items();

CREATE OR REPLACE FUNCTION public.guard_saved_item_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.products%ROWTYPE; v public.product_variants%ROWTYPE; qty integer;
BEGIN
  SELECT * INTO p FROM public.products WHERE id=NEW.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
  IF TG_TABLE_NAME='favorites' THEN
    IF p.stock_quantity<=0 THEN RAISE EXCEPTION 'OUT_OF_STOCK:%',p.name; END IF;
    RETURN NEW;
  END IF;
  qty := NEW.quantity;
  IF qty IS NULL OR qty<=0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
  IF NEW.variant_id IS NOT NULL THEN
    SELECT * INTO v FROM public.product_variants WHERE id=NEW.variant_id FOR UPDATE;
    IF NOT FOUND OR v.product_id<>p.id OR NOT v.is_active THEN RAISE EXCEPTION 'VARIANT_UNAVAILABLE:%',p.name; END IF;
    IF v.stock_quantity<qty THEN RAISE EXCEPTION 'OUT_OF_STOCK:%',p.name; END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id=p.id) THEN RAISE EXCEPTION 'VARIANT_REQUIRED:%',p.name; END IF;
    IF p.stock_quantity<qty THEN RAISE EXCEPTION 'OUT_OF_STOCK:%',p.name; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_saved_item_stock() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_cart_item_stock BEFORE INSERT OR UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.guard_saved_item_stock();
CREATE TRIGGER guard_favorite_stock BEFORE INSERT ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.guard_saved_item_stock();
CREATE TRIGGER guard_order_item_stock BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.guard_saved_item_stock();
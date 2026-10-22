ALTER TABLE public.categories ADD COLUMN color text;
COMMENT ON COLUMN public.categories.color IS 'Semantic category palette key; null preserves the existing category appearance.';
DROP POLICY "Admins can manage categories" ON public.categories;
CREATE POLICY "Platform owner manages categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
GRANT SELECT ON public.categories TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
CREATE OR REPLACE FUNCTION public.reorder_category(p_category_id uuid,p_direction text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE v_parent uuid; v_ids uuid[]; v_index int; v_swap int; v_other uuid;
BEGIN
 IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 IF p_direction NOT IN ('up','down') OR p_direction IS NULL THEN RAISE EXCEPTION 'invalid_direction'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('category-order'));
 SELECT parent_id INTO v_parent FROM public.categories WHERE id=p_category_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'category_not_found'; END IF;
 SELECT array_agg(id ORDER BY sort_order,name_ar,id) INTO v_ids FROM public.categories WHERE parent_id IS NOT DISTINCT FROM v_parent;
 v_index := array_position(v_ids,p_category_id);
 v_swap := v_index + CASE WHEN p_direction='up' THEN -1 ELSE 1 END;
 IF v_swap<1 OR v_swap>array_length(v_ids,1) THEN RETURN; END IF;
 v_other := v_ids[v_swap]; v_ids[v_swap] := p_category_id; v_ids[v_index] := v_other;
 UPDATE public.categories c SET sort_order=t.ordinality::int-1,updated_at=now() FROM unnest(v_ids) WITH ORDINALITY t(id,ordinality) WHERE c.id=t.id;
END;
$function$;
REVOKE ALL ON FUNCTION public.reorder_category(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reorder_category(uuid,text) TO authenticated,service_role;
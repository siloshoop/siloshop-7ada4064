-- 1. Server-side product comparison list (replaces localStorage)
CREATE TABLE IF NOT EXISTS public.compare_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT compare_items_unique UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_compare_items_user ON public.compare_items(user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.compare_items TO authenticated;
GRANT ALL ON public.compare_items TO service_role;
ALTER TABLE public.compare_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compare_items_select_own" ON public.compare_items
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "compare_items_insert_own" ON public.compare_items
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "compare_items_delete_own" ON public.compare_items
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Enforce max 4 compared products server-side
CREATE OR REPLACE FUNCTION public.enforce_compare_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.compare_items WHERE user_id = NEW.user_id) >= 4 THEN
    RAISE EXCEPTION 'compare_limit_reached';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_compare_limit ON public.compare_items;
CREATE TRIGGER trg_enforce_compare_limit
  BEFORE INSERT ON public.compare_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_compare_limit();

-- 2. Server-side search history (replaces localStorage)
CREATE TABLE IF NOT EXISTS public.search_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term TEXT NOT NULL CHECK (length(btrim(term)) BETWEEN 1 AND 120),
  searched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT search_history_unique UNIQUE (user_id, term)
);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON public.search_history(user_id, searched_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_history TO authenticated;
GRANT ALL ON public.search_history TO service_role;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "search_history_select_own" ON public.search_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "search_history_insert_own" ON public.search_history
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "search_history_update_own" ON public.search_history
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "search_history_delete_own" ON public.search_history
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Record a search term, keeping only the newest 8 per user
CREATE OR REPLACE FUNCTION public.record_search_term(_term TEXT)
RETURNS SETOF TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_term TEXT := btrim(_term);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF v_term = '' OR length(v_term) > 120 THEN
    RETURN;
  END IF;

  INSERT INTO public.search_history (user_id, term)
  VALUES (v_uid, v_term)
  ON CONFLICT (user_id, term) DO UPDATE SET searched_at = now();

  DELETE FROM public.search_history sh
  WHERE sh.user_id = v_uid
    AND sh.id NOT IN (
      SELECT id FROM public.search_history
      WHERE user_id = v_uid
      ORDER BY searched_at DESC
      LIMIT 8
    );

  RETURN QUERY
  SELECT term FROM public.search_history
  WHERE user_id = v_uid
  ORDER BY searched_at DESC
  LIMIT 8;
END;
$$;

REVOKE ALL ON FUNCTION public.record_search_term(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_search_term(TEXT) TO authenticated;

-- 3. Realtime for the returns workflow
ALTER TABLE public.returns REPLICA IDENTITY FULL;
ALTER TABLE public.return_status_history REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.returns;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.return_status_history;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
CREATE OR REPLACE FUNCTION public.normalize_store_name(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    regexp_replace(
      translate(
        regexp_replace(lower(btrim(coalesce(_name, ''))), '[\u064B-\u0652\u0640]', '', 'g'),
        'أإآةى', 'اااهي'
      ),
      '\s+', ' ', 'g'
    ),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION public.store_name_in_use(_name text, _exclude_user uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.seller_applications a
    WHERE public.normalize_store_name(a.store_name) = public.normalize_store_name(_name)
      AND a.status <> 'rejected'
      AND a.user_id IS DISTINCT FROM _exclude_user
  )
$$;

CREATE OR REPLACE FUNCTION public.is_store_name_available(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.normalize_store_name(_name) IS NOT NULL
     AND NOT public.store_name_in_use(_name, auth.uid())
$$;

REVOKE ALL ON FUNCTION public.store_name_in_use(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_store_name_available(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_unique_store_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _norm text := public.normalize_store_name(NEW.store_name);
BEGIN
  IF _norm IS NULL OR NEW.status = 'rejected' THEN
    RETURN NEW;
  END IF;
  -- Unchanged name and still active: keep existing (possibly legacy duplicate) stores working.
  IF TG_OP = 'UPDATE'
     AND public.normalize_store_name(OLD.store_name) IS NOT DISTINCT FROM _norm
     AND OLD.status <> 'rejected' THEN
    RETURN NEW;
  END IF;
  -- Serialize concurrent claims of the same name.
  PERFORM pg_advisory_xact_lock(hashtext('store_name:' || _norm));
  IF EXISTS (
    SELECT 1 FROM public.seller_applications a
    WHERE a.id IS DISTINCT FROM NEW.id
      AND a.user_id IS DISTINCT FROM NEW.user_id
      AND a.status <> 'rejected'
      AND public.normalize_store_name(a.store_name) = _norm
  ) THEN
    RAISE EXCEPTION 'store_name_taken' USING ERRCODE = 'unique_violation',
      DETAIL = 'اسم المتجر مستخدم من متجر آخر، اختر اسمًا مختلفًا';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_unique_store_name ON public.seller_applications;
CREATE TRIGGER trg_enforce_unique_store_name
  BEFORE INSERT OR UPDATE OF store_name, status ON public.seller_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_unique_store_name();

CREATE INDEX IF NOT EXISTS seller_applications_store_name_norm_idx
  ON public.seller_applications (public.normalize_store_name(store_name));

-- Helper: any moderation-capable role
CREATE OR REPLACE FUNCTION public.has_any_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'super_admin'::app_role, 'moderator'::app_role)
  );
$$;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.report_type AS ENUM ('product','seller','buyer','message','review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM ('pending','under_review','resolved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type public.report_type NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  description text,
  status public.report_status NOT NULL DEFAULT 'pending',
  resolution_note text,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_status_created_idx ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_type_idx ON public.reports (report_type);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON public.reports (reporter_id);
CREATE INDEX IF NOT EXISTS reports_target_idx ON public.reports (target_id);

GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reporters can insert their own reports" ON public.reports;
CREATE POLICY "Reporters can insert their own reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Reporters can view their own reports" ON public.reports;
CREATE POLICY "Reporters can view their own reports"
  ON public.reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Moderators can view all reports" ON public.reports;
CREATE POLICY "Moderators can view all reports"
  ON public.reports FOR SELECT TO authenticated
  USING (public.has_any_admin_role(auth.uid()));

DROP POLICY IF EXISTS "Moderators can update reports" ON public.reports;
CREATE POLICY "Moderators can update reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (public.has_any_admin_role(auth.uid()))
  WITH CHECK (public.has_any_admin_role(auth.uid()));

DROP TRIGGER IF EXISTS reports_set_updated_at ON public.reports;
CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reviews: hidden flag for moderation
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_reason text,
  ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

-- Messages: soft delete flag (used by moderator RPC)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- RPC: paginated list with filters
CREATE OR REPLACE FUNCTION public.admin_list_reports(
  _status public.report_status DEFAULT NULL,
  _type public.report_type DEFAULT NULL,
  _search text DEFAULT NULL,
  _limit int DEFAULT 50,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid, reporter_id uuid, reporter_name text, reporter_email text,
  report_type public.report_type, target_id uuid,
  reason text, description text,
  status public.report_status, resolution_note text,
  resolved_by uuid, resolved_at timestamptz,
  created_at timestamptz, updated_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT r.*
    FROM public.reports r
    WHERE (_status IS NULL OR r.status = _status)
      AND (_type IS NULL OR r.report_type = _type)
      AND (
        _search IS NULL OR length(trim(_search)) = 0
        OR r.reason ILIKE '%'||_search||'%'
        OR COALESCE(r.description,'') ILIKE '%'||_search||'%'
        OR r.target_id::text ILIKE '%'||_search||'%'
        OR r.id::text ILIKE '%'||_search||'%'
      )
  ),
  counted AS (SELECT count(*)::bigint AS c FROM filtered)
  SELECT f.id, f.reporter_id,
         p.full_name AS reporter_name,
         u.email AS reporter_email,
         f.report_type, f.target_id,
         f.reason, f.description,
         f.status, f.resolution_note,
         f.resolved_by, f.resolved_at,
         f.created_at, f.updated_at,
         (SELECT c FROM counted) AS total_count
  FROM filtered f
  LEFT JOIN public.profiles p ON p.id = f.reporter_id
  LEFT JOIN auth.users u ON u.id = f.reporter_id
  ORDER BY f.created_at DESC
  LIMIT GREATEST(_limit, 1) OFFSET GREATEST(_offset, 0);
END; $$;

-- RPC: update report status
CREATE OR REPLACE FUNCTION public.admin_update_report(
  _report_id uuid,
  _status public.report_status,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _reporter uuid;
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.reports
     SET status = _status,
         resolution_note = COALESCE(_note, resolution_note),
         resolved_by = CASE WHEN _status IN ('resolved','rejected') THEN auth.uid() ELSE resolved_by END,
         resolved_at = CASE WHEN _status IN ('resolved','rejected') THEN now() ELSE resolved_at END,
         updated_at = now()
   WHERE id = _report_id
   RETURNING reporter_id INTO _reporter;

  IF _reporter IS NULL THEN
    RAISE EXCEPTION 'report_not_found';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, related_id)
  VALUES (
    _reporter,
    'تحديث بلاغك',
    'تم تحديث حالة بلاغك إلى: ' || _status::text,
    'report_update',
    _report_id
  );
END; $$;

-- RPC: hide / unhide review
CREATE OR REPLACE FUNCTION public.admin_hide_review(_review_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.reviews
     SET is_hidden = true, hidden_reason = _reason,
         hidden_by = auth.uid(), hidden_at = now()
   WHERE id = _review_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_unhide_review(_review_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.reviews
     SET is_hidden = false, hidden_reason = NULL, hidden_by = NULL, hidden_at = NULL
   WHERE id = _review_id;
END; $$;

-- RPC: soft-delete a message
CREATE OR REPLACE FUNCTION public.admin_delete_message(_message_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_any_admin_role(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.messages
     SET is_deleted = true, deleted_by = auth.uid(), deleted_at = now(),
         content = '[تم حذف الرسالة من قبل الإدارة]'
   WHERE id = _message_id;
END; $$;

-- RPC: submit report (validates target exists)
CREATE OR REPLACE FUNCTION public.submit_report(
  _report_type public.report_type,
  _target_id uuid,
  _reason text,
  _description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
  _exists boolean;
  _recent int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'reason_required'; END IF;

  -- Basic rate limit: max 10 reports per hour per user
  SELECT count(*) INTO _recent FROM public.reports
    WHERE reporter_id = _uid AND created_at > now() - interval '1 hour';
  IF _recent >= 10 THEN RAISE EXCEPTION 'rate_limited'; END IF;

  -- Validate target exists
  CASE _report_type
    WHEN 'product' THEN SELECT EXISTS(SELECT 1 FROM public.products WHERE id = _target_id) INTO _exists;
    WHEN 'seller','buyer' THEN SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = _target_id) INTO _exists;
    WHEN 'message' THEN SELECT EXISTS(SELECT 1 FROM public.messages WHERE id = _target_id) INTO _exists;
    WHEN 'review' THEN SELECT EXISTS(SELECT 1 FROM public.reviews WHERE id = _target_id) INTO _exists;
  END CASE;
  IF NOT _exists THEN RAISE EXCEPTION 'target_not_found'; END IF;

  INSERT INTO public.reports (reporter_id, report_type, target_id, reason, description)
  VALUES (_uid, _report_type, _target_id, _reason, _description)
  RETURNING id INTO _id;

  RETURN _id;
END; $$;

GRANT EXECUTE ON FUNCTION public.submit_report(public.report_type, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(public.report_status, public.report_type, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_report(uuid, public.report_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_hide_review(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unhide_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_admin_role(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_reports(_status report_status DEFAULT NULL::report_status, _type report_type DEFAULT NULL::report_type, _search text DEFAULT NULL::text, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, reporter_id uuid, reporter_name text, reporter_email text, report_type report_type, target_id uuid, reason text, description text, status report_status, resolution_note text, resolved_by uuid, resolved_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         p.full_name::text AS reporter_name,
         u.email::text AS reporter_email,
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
END; $function$;
REVOKE ALL ON FUNCTION public.admin_list_reports(report_status, report_type, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_reports(report_status, report_type, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(report_status, report_type, text, integer, integer) TO authenticated, service_role;
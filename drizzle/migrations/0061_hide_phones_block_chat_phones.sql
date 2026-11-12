-- Seller phone numbers are visible only to the seller and the platform staff.
CREATE OR REPLACE FUNCTION public.get_store_public_contact(_vendor_id uuid)
 RETURNS TABLE(contact_phone text, address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT NULL::text, NULLIF(sa.address,'') FROM public.seller_applications sa JOIN public.profiles p ON p.id=sa.user_id
 WHERE sa.user_id=_vendor_id AND sa.status='approved' AND p.role='vendor' AND p.account_status='active'
 ORDER BY sa.created_at DESC,sa.id DESC LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.get_store_public_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_public_contact(uuid) TO anon,authenticated,service_role;

-- Detects phone numbers in chat text (mirrors src/lib/chatPhone.ts).
CREATE OR REPLACE FUNCTION public.chat_text_has_phone(_t text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE n text;
BEGIN
  IF _t IS NULL OR _t = '' THEN RETURN false; END IF;
  n := translate(_t, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  n := regexp_replace(n, '[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]', '', 'g');
  n := regexp_replace(n, '[A-Za-z]{2,4}-[0-9]{4}-[0-9]{4,8}', ' ', 'g');
  n := regexp_replace(n, '\+[\s\-.()]+', '+', 'g');
  n := regexp_replace(n, '([0-9])[\s\-.()_/\\,،٬]+(?=[0-9])', '\1', 'g');
  RETURN n ~ '\+[0-9]{7,}' OR n ~ '[0-9]{10,}' OR n ~ '(^|[^0-9])[09][0-9]{8}([^0-9]|$)';
END;
$function$;
GRANT EXECUTE ON FUNCTION public.chat_text_has_phone(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.block_chat_phone_numbers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(),'') = 'service_role' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.content IS NOT DISTINCT FROM OLD.content THEN RETURN NEW; END IF;
  IF NEW.message_type IN ('system','order_update','return_update','admin_notice') THEN RETURN NEW; END IF;
  IF public.has_any_admin_role(NEW.sender_id) THEN RETURN NEW; END IF;
  IF public.chat_text_has_phone(NEW.content) THEN
    RAISE EXCEPTION 'phone_not_allowed' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.block_chat_phone_numbers() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS block_chat_phone_numbers ON public.messages;
CREATE TRIGGER block_chat_phone_numbers
  BEFORE INSERT OR UPDATE OF content ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.block_chat_phone_numbers();
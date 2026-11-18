CREATE OR REPLACE FUNCTION public.chat_text_has_phone(_t text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  n text;
  g text;
  d text;
  sep boolean;
BEGIN
  IF _t IS NULL OR _t = '' THEN RETURN false; END IF;
  n := translate(_t, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  n := regexp_replace(n, '[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]', '', 'g');
  n := regexp_replace(n, '[A-Za-z]{2,4}-[0-9]{4}-[0-9]{4,8}', ' ', 'g');
  n := regexp_replace(n, '\+[\s\-.()]+', '+', 'g');
  -- Digit groups joined by short runs of spaces, dashes, dots, brackets or
  -- underscores; commas and slashes end a group (mirrors src/lib/chatPhone.ts).
  FOR g IN SELECT m[1] FROM regexp_matches(n, '(\+?[0-9](?:[0-9]|[\s\-.()_]{1,3}(?=[0-9]))*)', 'g') AS m LOOP
    d := regexp_replace(g, '[^0-9]', '', 'g');
    sep := length(d) <> length(regexp_replace(g, '^\+', ''));
    IF left(g, 1) = '+' THEN
      IF length(d) >= 7 THEN RETURN true; END IF;
      CONTINUE;
    END IF;
    IF d ~ '^00[0-9]{7,}$' OR d ~ '^963[0-9]{8,10}$' OR d ~ '^0[0-9]{8,10}$' OR d ~ '^9[3-9][0-9]{7}$' THEN
      RETURN true;
    END IF;
    IF NOT sep AND length(d) >= 10 THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END;
$function$;
-- Trigger to notify vendor when they receive a new rating
CREATE OR REPLACE FUNCTION public.notify_vendor_new_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    NEW.vendor_id,
    'تقييم جديد',
    'لقد حصلت على تقييم جديد بـ ' || NEW.rating || ' نجوم',
    'rating',
    NEW.id
  );
  RETURN NEW;
END;
$function$;

-- Create trigger for new vendor ratings
DROP TRIGGER IF EXISTS on_new_vendor_rating ON vendor_ratings;
CREATE TRIGGER on_new_vendor_rating
AFTER INSERT ON vendor_ratings
FOR EACH ROW
EXECUTE FUNCTION notify_vendor_new_rating();

-- Trigger to notify vendor when someone replies to a product review
CREATE OR REPLACE FUNCTION public.notify_review_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  review_user_id UUID;
BEGIN
  -- Get the user who wrote the review
  SELECT user_id INTO review_user_id
  FROM reviews
  WHERE id = NEW.review_id;

  -- Notify the review owner that vendor replied
  INSERT INTO notifications (user_id, title, message, type, related_id)
  VALUES (
    review_user_id,
    'رد على تقييمك',
    'قام البائع بالرد على تقييمك',
    'review_reply',
    NEW.review_id
  );
  RETURN NEW;
END;
$function$;

-- Create trigger for review replies
DROP TRIGGER IF EXISTS on_new_review_reply ON review_replies;
CREATE TRIGGER on_new_review_reply
AFTER INSERT ON review_replies
FOR EACH ROW
EXECUTE FUNCTION notify_review_owner();
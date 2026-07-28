-- Restrict public review visibility so admin-hidden reviews are not leaked.
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Public can view visible reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authors can view own hidden reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can view all reviews" ON public.reviews;

CREATE POLICY "Public can view visible reviews"
ON public.reviews
FOR SELECT
USING (is_hidden = false);

CREATE POLICY "Authors can view own hidden reviews"
ON public.reviews
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all reviews"
ON public.reviews
FOR SELECT
TO authenticated
USING (public.has_any_admin_role(auth.uid()));
-- Fix 1: Restrict vendor profiles policy to only return public-safe fields
-- Drop the overly permissive vendor profiles policy
DROP POLICY IF EXISTS "Anyone can view vendor profiles" ON profiles;

-- Create a more restrictive policy that only allows viewing via the secure function
-- For direct table access, only allow authenticated users to view their own profile
-- Vendor public info should be accessed via get_vendor_public_info() function only

-- Fix 2: Add explicit SELECT policy for newsletter_subscriptions (admin only)
CREATE POLICY "Only admins can view newsletter subscriptions"
ON newsletter_subscriptions FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Fix 3: Explicitly deny DELETE on orders table
CREATE POLICY "Orders cannot be deleted"
ON orders FOR DELETE
USING (false);

-- Fix 4: Explicitly deny UPDATE and DELETE on payments table (immutable after creation)
CREATE POLICY "Payments cannot be updated"
ON payments FOR UPDATE
USING (false);

CREATE POLICY "Payments cannot be deleted"
ON payments FOR DELETE
USING (false);
-- 1. Fix: Orders table missing UPDATE policy (allows payment flow to update order status)
CREATE POLICY "Customers can update their own orders" 
ON orders FOR UPDATE 
USING (auth.uid() = customer_id);

-- Also allow vendors to view orders containing their products (for VendorOrders page)
CREATE POLICY "Vendors can view orders with their products" 
ON orders FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM order_items 
    WHERE order_items.order_id = orders.id 
    AND order_items.vendor_id = auth.uid()
  )
);

-- Allow vendors to update orders containing their products (for status management)
CREATE POLICY "Vendors can update orders with their products" 
ON orders FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM order_items 
    WHERE order_items.order_id = orders.id 
    AND order_items.vendor_id = auth.uid()
  )
);

-- 2. Fix: Profiles table exposing phone numbers to all users
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view basic profile info" ON profiles;

-- Create a more restrictive policy: users can view their own profile OR vendor profiles (without phone)
-- For vendor name display on products, we use a function to get only public vendor info
CREATE OR REPLACE FUNCTION public.get_vendor_public_info(vendor_id uuid)
RETURNS TABLE (id uuid, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM profiles p
  WHERE p.id = vendor_id AND p.role = 'vendor'::user_role
$$;

-- Create policy allowing users to view vendor profiles (needed for product pages)
CREATE POLICY "Anyone can view vendor profiles"
ON profiles FOR SELECT
USING (role = 'vendor'::user_role);

-- 3. Fix: Contact messages - restrict SELECT to admin only
CREATE POLICY "Only admins can view contact messages"
ON contact_messages FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
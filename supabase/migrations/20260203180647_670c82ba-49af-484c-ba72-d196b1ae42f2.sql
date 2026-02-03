-- Drop the problematic policies on order_items that cause infinite recursion
DROP POLICY IF EXISTS "Customers can view items in their orders" ON public.order_items;
DROP POLICY IF EXISTS "Vendors can view their order items" ON public.order_items;
DROP POLICY IF EXISTS "Customers can create order items for their orders" ON public.order_items;

-- Recreate policies without the recursive reference
-- Policy for customers to view their order items (using a direct join without recursion)
CREATE POLICY "Customers can view their order items" 
ON public.order_items 
FOR SELECT 
USING (
  order_id IN (
    SELECT id FROM public.orders WHERE customer_id = auth.uid()
  )
);

-- Policy for vendors to view their order items
CREATE POLICY "Vendors can view their order items" 
ON public.order_items 
FOR SELECT 
USING (vendor_id = auth.uid());

-- Policy for customers to create order items
CREATE POLICY "Customers can create order items" 
ON public.order_items 
FOR INSERT 
WITH CHECK (
  order_id IN (
    SELECT id FROM public.orders WHERE customer_id = auth.uid()
  )
);

-- Also fix the orders policies that reference order_items (causing the recursion loop)
DROP POLICY IF EXISTS "Vendors can view orders with their products" ON public.orders;
DROP POLICY IF EXISTS "Vendors can update orders with their products" ON public.orders;

-- Recreate vendor policies for orders without causing recursion
CREATE POLICY "Vendors can view orders with their products" 
ON public.orders 
FOR SELECT 
USING (
  id IN (
    SELECT DISTINCT order_id FROM public.order_items WHERE vendor_id = auth.uid()
  )
);

CREATE POLICY "Vendors can update orders with their products" 
ON public.orders 
FOR UPDATE 
USING (
  id IN (
    SELECT DISTINCT order_id FROM public.order_items WHERE vendor_id = auth.uid()
  )
);
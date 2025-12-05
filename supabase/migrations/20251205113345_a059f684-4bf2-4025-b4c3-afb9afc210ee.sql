-- Drop the vendor profiles policy since frontend now uses secure function
DROP POLICY IF EXISTS "Anyone can view vendor profiles" ON profiles;
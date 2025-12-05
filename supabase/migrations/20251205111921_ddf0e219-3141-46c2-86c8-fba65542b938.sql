-- Allow authenticated users to view basic profile info (name, avatar)
-- This is needed for vendors to see customer names and customers to see vendor names
CREATE POLICY "Authenticated users can view basic profile info" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);
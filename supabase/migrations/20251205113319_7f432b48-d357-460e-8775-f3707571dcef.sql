-- Re-add vendor profiles policy (needed for product joins)
-- This policy only allows viewing vendor role profiles
CREATE POLICY "Anyone can view vendor profiles"
ON profiles FOR SELECT
USING (role = 'vendor'::user_role);
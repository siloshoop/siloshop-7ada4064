-- Add ban columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_banned boolean NOT NULL DEFAULT false,
ADD COLUMN banned_at timestamp with time zone DEFAULT NULL,
ADD COLUMN ban_reason text DEFAULT NULL;

-- Create policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = 'admin'::app_role
));

-- Create policy for admins to update any profile (for banning)
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = 'admin'::app_role
));
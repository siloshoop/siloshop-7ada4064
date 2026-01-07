-- Create saved_comparisons table
CREATE TABLE public.saved_comparisons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'مقارنة محفوظة',
  product_ids UUID[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_comparisons ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own saved comparisons
CREATE POLICY "Users can manage their own saved comparisons"
ON public.saved_comparisons
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
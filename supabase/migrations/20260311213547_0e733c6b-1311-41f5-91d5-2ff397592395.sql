
-- Create native_ads table
CREATE TABLE public.native_ads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  image_url text,
  cta_text text NOT NULL DEFAULT 'تسوق الآن',
  cta_url text,
  sponsor_name text NOT NULL DEFAULT 'إعلان ممول',
  placement text NOT NULL DEFAULT 'search', -- where to show: search, home, category
  priority integer NOT NULL DEFAULT 0, -- higher = shown first
  is_active boolean NOT NULL DEFAULT true,
  start_date timestamp with time zone DEFAULT now(),
  end_date timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.native_ads ENABLE ROW LEVEL SECURITY;

-- Anyone can view active ads (public content)
CREATE POLICY "Anyone can view active native ads"
ON public.native_ads
FOR SELECT
TO public
USING (
  is_active = true 
  AND (start_date IS NULL OR start_date <= now()) 
  AND (end_date IS NULL OR end_date > now())
);

-- Admins can manage all ads
CREATE POLICY "Admins can manage native ads"
ON public.native_ads
FOR ALL
TO public
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Index for fetching active ads
CREATE INDEX idx_native_ads_active ON public.native_ads (is_active, placement, priority DESC) WHERE is_active = true;

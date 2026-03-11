
-- Create ad_analytics table for tracking impressions and clicks
CREATE TABLE public.ad_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_slot text NOT NULL,
  event_type text NOT NULL DEFAULT 'impression', -- 'impression' or 'click'
  user_id uuid,
  session_id text,
  page_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ad_analytics ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public tracking, no auth required)
CREATE POLICY "Anyone can insert ad analytics"
ON public.ad_analytics
FOR INSERT
TO public
WITH CHECK (true);

-- Only admins can view analytics
CREATE POLICY "Admins can view ad analytics"
ON public.ad_analytics
FOR SELECT
TO public
USING (public.has_role(auth.uid(), 'admin'));

-- Index for fast queries
CREATE INDEX idx_ad_analytics_slot_type ON public.ad_analytics (ad_slot, event_type);
CREATE INDEX idx_ad_analytics_created_at ON public.ad_analytics (created_at);

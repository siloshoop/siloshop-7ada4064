-- Create review_replies table for vendor responses
CREATE TABLE public.review_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL,
  reply TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;

-- Anyone can view replies
CREATE POLICY "Anyone can view review replies"
ON public.review_replies FOR SELECT
USING (true);

-- Vendors can create replies on their product reviews
CREATE POLICY "Vendors can create replies"
ON public.review_replies FOR INSERT
WITH CHECK (
  auth.uid() = vendor_id AND
  EXISTS (
    SELECT 1 FROM reviews r
    JOIN products p ON p.id = r.product_id
    WHERE r.id = review_replies.review_id AND p.vendor_id = auth.uid()
  )
);

-- Vendors can update their own replies
CREATE POLICY "Vendors can update their replies"
ON public.review_replies FOR UPDATE
USING (auth.uid() = vendor_id);

-- Vendors can delete their own replies
CREATE POLICY "Vendors can delete their replies"
ON public.review_replies FOR DELETE
USING (auth.uid() = vendor_id);

-- Create vendor_ratings table
CREATE TABLE public.vendor_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, user_id)
);

-- Enable RLS
ALTER TABLE public.vendor_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can view vendor ratings
CREATE POLICY "Anyone can view vendor ratings"
ON public.vendor_ratings FOR SELECT
USING (true);

-- Authenticated users can create ratings
CREATE POLICY "Users can rate vendors"
ON public.vendor_ratings FOR INSERT
WITH CHECK (auth.uid() = user_id AND auth.uid() != vendor_id);

-- Users can update their own ratings
CREATE POLICY "Users can update their ratings"
ON public.vendor_ratings FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete their ratings"
ON public.vendor_ratings FOR DELETE
USING (auth.uid() = user_id);

-- Allow users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for review_replies updated_at
CREATE TRIGGER update_review_replies_updated_at
BEFORE UPDATE ON public.review_replies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for vendor_ratings updated_at
CREATE TRIGGER update_vendor_ratings_updated_at
BEFORE UPDATE ON public.vendor_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
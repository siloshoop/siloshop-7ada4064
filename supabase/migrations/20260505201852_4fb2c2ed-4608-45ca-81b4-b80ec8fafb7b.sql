-- Delivery addresses table
CREATE TABLE public.delivery_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  city TEXT NOT NULL,
  street TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their addresses"
ON public.delivery_addresses FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_delivery_addresses_user ON public.delivery_addresses(user_id);
CREATE UNIQUE INDEX idx_delivery_addresses_one_default
  ON public.delivery_addresses(user_id) WHERE is_default = true;

CREATE TRIGGER update_delivery_addresses_updated_at
BEFORE UPDATE ON public.delivery_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to set a default address (clears others atomically)
CREATE OR REPLACE FUNCTION public.set_default_address(_address_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.delivery_addresses
    WHERE id = _address_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Address not found';
  END IF;

  UPDATE public.delivery_addresses
  SET is_default = false
  WHERE user_id = auth.uid() AND is_default = true;

  UPDATE public.delivery_addresses
  SET is_default = true
  WHERE id = _address_id AND user_id = auth.uid();
END;
$$;

-- Add image_url column to reviews for optional review photo
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Storage bucket for review images
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-images', 'review-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view review images"
ON storage.objects FOR SELECT
USING (bucket_id = 'review-images');

CREATE POLICY "Authenticated can upload review images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'review-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own review images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'review-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
-- Create wishlists table
CREATE TABLE public.wishlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'قائمة أمنياتي',
  share_token UUID NOT NULL DEFAULT gen_random_uuid(),
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wishlist items table
CREATE TABLE public.wishlist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wishlist_id UUID NOT NULL REFERENCES public.wishlists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wishlist_id, product_id)
);

-- Enable RLS
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

-- Wishlists policies
CREATE POLICY "Users can manage their own wishlists"
ON public.wishlists
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view public wishlists by share token"
ON public.wishlists
FOR SELECT
USING (is_public = true);

-- Wishlist items policies
CREATE POLICY "Users can manage items in their wishlists"
ON public.wishlist_items
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.wishlists
  WHERE wishlists.id = wishlist_items.wishlist_id
  AND wishlists.user_id = auth.uid()
));

CREATE POLICY "Anyone can view items in public wishlists"
ON public.wishlist_items
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.wishlists
  WHERE wishlists.id = wishlist_items.wishlist_id
  AND wishlists.is_public = true
));

-- Create index for share token lookups
CREATE INDEX idx_wishlists_share_token ON public.wishlists(share_token);

-- Trigger for updated_at
CREATE TRIGGER update_wishlists_updated_at
BEFORE UPDATE ON public.wishlists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
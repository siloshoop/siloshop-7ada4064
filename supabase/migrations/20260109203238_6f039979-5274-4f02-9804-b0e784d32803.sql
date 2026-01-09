-- Create brands table
CREATE TABLE public.brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Brands are viewable by everyone" 
ON public.brands 
FOR SELECT 
USING (true);

-- Add brand_id to products table
ALTER TABLE public.products 
ADD COLUMN brand_id UUID REFERENCES public.brands(id);

-- Create index for better performance
CREATE INDEX idx_products_brand_id ON public.products(brand_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_brands_updated_at
BEFORE UPDATE ON public.brands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample brands
INSERT INTO public.brands (name, name_ar, logo_url) VALUES
('Apple', 'آبل', 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg'),
('Samsung', 'سامسونج', 'https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg'),
('Sony', 'سوني', 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Sony_logo.svg'),
('LG', 'إل جي', 'https://upload.wikimedia.org/wikipedia/commons/2/20/LG_symbol.svg'),
('Nike', 'نايكي', 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg'),
('Adidas', 'أديداس', 'https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg'),
('Huawei', 'هواوي', 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Huawei_Logo.svg'),
('Dell', 'ديل', 'https://upload.wikimedia.org/wikipedia/commons/4/48/Dell_Logo.svg');
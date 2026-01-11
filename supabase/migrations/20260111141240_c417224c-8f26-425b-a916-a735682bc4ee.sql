-- Create announcements table
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  icon TEXT DEFAULT 'tag',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read active announcements
CREATE POLICY "Anyone can view active announcements"
ON public.announcements
FOR SELECT
USING (is_active = true AND (end_date IS NULL OR end_date > now()));

-- Allow admins to manage announcements
CREATE POLICY "Admins can manage announcements"
ON public.announcements
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default announcements
INSERT INTO public.announcements (text, icon, sort_order) VALUES
('🔥 خصم 50% على جميع المنتجات الإلكترونية - لفترة محدودة!', 'percent', 1),
('🎁 اشترِ 2 واحصل على الثالث مجاناً!', 'gift', 2),
('🚚 شحن مجاني للطلبات أكثر من 200 ريال', 'truck', 3),
('💫 عروض حصرية للمستخدمين الجدد - خصم 30%', 'tag', 4);
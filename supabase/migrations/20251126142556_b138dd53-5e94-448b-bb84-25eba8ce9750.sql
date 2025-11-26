-- إنشاء جدول لقواعد الخصومات حسب الكمية
CREATE TABLE IF NOT EXISTS quantity_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL,
  discount_percentage NUMERIC NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT unique_product_quantity UNIQUE (product_id, min_quantity)
);

-- Enable RLS
ALTER TABLE quantity_discounts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view quantity discounts
CREATE POLICY "Anyone can view quantity discounts"
  ON quantity_discounts
  FOR SELECT
  USING (true);

-- Policy: Vendors can manage their product discounts
CREATE POLICY "Vendors can manage their product discounts"
  ON quantity_discounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = quantity_discounts.product_id 
      AND products.vendor_id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_quantity_discounts_updated_at
  BEFORE UPDATE ON quantity_discounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- إضافة بعض قواعد الخصومات الافتراضية للمنتجات الموجودة
INSERT INTO quantity_discounts (product_id, min_quantity, discount_percentage)
SELECT id, 3, 10 FROM products WHERE is_active = true LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO quantity_discounts (product_id, min_quantity, discount_percentage)
SELECT id, 5, 15 FROM products WHERE is_active = true LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO quantity_discounts (product_id, min_quantity, discount_percentage)
SELECT id, 10, 20 FROM products WHERE is_active = true LIMIT 5
ON CONFLICT DO NOTHING;
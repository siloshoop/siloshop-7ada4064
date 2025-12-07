import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "./ProductCard";
import { Loader2, Zap, Clock } from "lucide-react";
import { Badge } from "./ui/badge";

interface DealProduct {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  reviews: { rating: number }[];
  deal_discount: number;
  deal_end_date: string;
}

const DailyDeals = () => {
  const [products, setProducts] = useState<DealProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const { data: deals } = await supabase
          .from("daily_deals")
          .select(`
            id,
            discount_percentage,
            end_date,
            product_id,
            products (
              id,
              name,
              price,
              original_price,
              image_url,
              reviews (rating)
            )
          `)
          .eq("is_active", true)
          .gt("end_date", new Date().toISOString())
          .order("end_date", { ascending: true })
          .limit(4);

        const dealProducts: DealProduct[] = (deals || [])
          .filter(deal => deal.products)
          .map(deal => ({
            id: (deal.products as any).id,
            name: (deal.products as any).name,
            price: (deal.products as any).price,
            original_price: (deal.products as any).original_price,
            image_url: (deal.products as any).image_url,
            reviews: (deal.products as any).reviews || [],
            deal_discount: deal.discount_percentage,
            deal_end_date: deal.end_date
          }));

        setProducts(dealProducts);

        // Set countdown to first deal end time
        if (dealProducts.length > 0) {
          updateCountdown(dealProducts[0].deal_end_date);
        }
      } catch (error) {
        console.error("Error fetching deals:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  const updateCountdown = (endDate: string) => {
    const update = () => {
      const now = new Date().getTime();
      const end = new Date(endDate).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("انتهى العرض");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  };

  useEffect(() => {
    if (products.length > 0) {
      const cleanup = updateCountdown(products[0].deal_end_date);
      return cleanup;
    }
  }, [products]);

  if (loading) {
    return (
      <section className="py-12 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="container px-4">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-12 bg-gradient-to-r from-primary/5 to-accent/5">
      <div className="container px-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Zap className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">عروض اليوم</h2>
              <p className="text-muted-foreground text-sm">خصومات حصرية لفترة محدودة</p>
            </div>
          </div>
          <Badge variant="destructive" className="flex items-center gap-2 px-4 py-2 text-lg">
            <Clock className="h-4 w-4" />
            {timeLeft}
          </Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            const avgRating = product.reviews?.length
              ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
              : 0;
            
            // Calculate deal price
            const dealPrice = product.price * (1 - product.deal_discount / 100);

            return (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={dealPrice}
                originalPrice={product.price}
                image={product.image_url}
                rating={avgRating}
                reviews={product.reviews?.length || 0}
                discount={product.deal_discount}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default DailyDeals;

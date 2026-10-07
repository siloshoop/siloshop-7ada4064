import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "./ProductCard";
import { Loader2, Flame, Clock, ArrowLeft } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

interface DealProduct {
  id: string;
  name: string;
  price: number;
  stock_quantity?: number | null;
  currency?: string | null;
  original_price: number | null;
  image_url: string;
  shipping_cost?: number | null;
  shipping_mode?: string | null;
  reviews: { rating: number }[];
  deal_discount: number;
  deal_end_date: string;
}

const EnhancedDailyDeals = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<DealProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isVisible, setIsVisible] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

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
              currency,
              original_price,
              image_url,
              shipping_cost,
              shipping_mode,
              reviews (rating)
            )
          `)
          .eq("is_active", true)
          .gt("end_date", new Date().toISOString())
          .lte("start_date", new Date().toISOString())
          .order("end_date", { ascending: true })
          .limit(6);

        const dealProducts: DealProduct[] = (deals || [])
          .filter(deal => deal.products)
          .map(deal => ({
            id: (deal.products as any).id,
            name: (deal.products as any).name,
            price: (deal.products as any).price,
            currency: (deal.products as any).currency,
            stock_quantity: (deal.products as any).stock_quantity,
            original_price: (deal.products as any).original_price,
            image_url: (deal.products as any).image_url,
            shipping_cost: (deal.products as any).shipping_cost,
            shipping_mode: (deal.products as any).shipping_mode,
            reviews: (deal.products as any).reviews || [],
            deal_discount: deal.discount_percentage,
            deal_end_date: deal.end_date
          }));

        setProducts(dealProducts);
      } catch (error) {
        console.error("Error fetching deals:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  useEffect(() => {
    if (products.length === 0) return;

    const endDate = new Date(products[0].deal_end_date).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = endDate - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      setTimeLeft({
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [products]);

  // Return null immediately if loading or no products - don't show any loader for empty sections
  if (loading || products.length === 0) {
    return null;
  }

  return (
    <section ref={sectionRef} className="py-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 via-background to-primary/5" />
      
      <div className="container px-4 relative z-10">
        {/* Compact Header */}
        <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-destructive to-destructive/80 shadow-sm">
              <Flame className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-foreground leading-tight">
                عروض اليوم
              </h2>
              <p className="text-muted-foreground text-xs">خصومات لفترة محدودة</p>
            </div>
          </div>
          
          {/* Compact Countdown Timer: أيام : ساعات : دقائق : ثواني */}
          <div className="flex items-center gap-2 bg-destructive/10 rounded-lg px-3 py-1.5 glass">
            <Clock className="h-4 w-4 text-destructive" />
            <div className="flex items-center gap-1 font-bold text-destructive tabular-nums" aria-label="الوقت المتبقي">
              {([
                [timeLeft.days, "أيام"],
                [timeLeft.hours, "ساعات"],
                [timeLeft.minutes, "دقائق"],
                [timeLeft.seconds, "ثواني"],
              ] as const).map(([value, label], i) => (
                <div key={label} className="flex items-center gap-1">
                  {i > 0 && <span className="text-sm">:</span>}
                  <div className="flex flex-col items-center leading-none">
                    <span className="min-w-[1.75rem] rounded bg-destructive px-1 py-0.5 text-center text-sm text-primary-foreground">
                      {String(Math.min(value, 99)).padStart(2, "0")}
                    </span>
                    <span className="mt-0.5 text-[9px] font-medium text-muted-foreground">{label}</span>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              size="sm" 
              variant="destructive"
              className="hidden sm:flex gap-1 text-xs glow-on-hover"
              onClick={() => navigate("/search?discount=true")}
            >
              عرض الكل
              <ArrowLeft className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="product-grid">
          {products.map((product, index) => {
            const avgRating = product.reviews?.length
              ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
              : 0;
            
            const dealPrice = product.price * (1 - product.deal_discount / 100);

            return (
              <div 
                key={product.id} 
                className={`relative transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'}`}
                style={{ transitionDelay: `${200 + index * 50}ms` }}
              >
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1.5 -right-1.5 z-10 text-xs px-2 py-0.5 shadow-md animate-bounce-in"
                >
                  -{product.deal_discount}%
                </Badge>
                <ProductCard
                  id={product.id}
                  stockQuantity={product.stock_quantity}
                  name={product.name}
                  price={dealPrice}
                  currency={(product as any).currency}
                  originalPrice={product.price}
                  image={product.image_url}
                  rating={avgRating}
                  reviews={product.reviews?.length || 0}
                  discount={product.deal_discount}
                  shippingCost={(product as any).shipping_cost ?? 0}
                  shippingMode={(product as any).shipping_mode}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default EnhancedDailyDeals;

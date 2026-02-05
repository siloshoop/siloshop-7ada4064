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
  original_price: number | null;
  image_url: string;
  reviews: { rating: number }[];
  deal_discount: number;
  deal_end_date: string;
}

const EnhancedDailyDeals = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<DealProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isVisible, setIsVisible] = useState(false);
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
              original_price,
              image_url,
              reviews (rating)
            )
          `)
          .eq("is_active", true)
          .gt("end_date", new Date().toISOString())
          .order("end_date", { ascending: true })
          .limit(6);

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
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
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
    <section ref={sectionRef} className="py-8 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 via-background to-primary/5" />
      <div className="absolute top-0 left-0 w-64 h-64 bg-destructive/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
      
      <div className="container px-4 relative z-10">
        {/* Compact Header */}
        <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-destructive to-destructive/80 shadow-md animate-pulse-glow">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-foreground">
                عروض اليوم
              </h2>
              <p className="text-muted-foreground text-sm">خصومات لفترة محدودة</p>
            </div>
          </div>
          
          {/* Compact Countdown Timer */}
          <div className="flex items-center gap-3 bg-destructive/10 rounded-xl px-4 py-2 glass">
            <Clock className="h-4 w-4 text-destructive animate-pulse" />
            <div className="flex items-center gap-1 text-lg font-bold text-destructive">
              <span className="bg-destructive text-white px-2 py-0.5 rounded shadow-md">
                {String(timeLeft.hours).padStart(2, "0")}
              </span>
              <span className="animate-pulse">:</span>
              <span className="bg-destructive text-white px-2 py-0.5 rounded shadow-md">
                {String(timeLeft.minutes).padStart(2, "0")}
              </span>
              <span className="animate-pulse">:</span>
              <span className="bg-destructive text-white px-2 py-0.5 rounded shadow-md">
                {String(timeLeft.seconds).padStart(2, "0")}
              </span>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {products.map((product, index) => {
            const avgRating = product.reviews?.length
              ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
              : 0;
            
            const dealPrice = product.price * (1 - product.deal_discount / 100);

            return (
              <div 
                key={product.id} 
                className={`relative transition-all duration-500 hover-lift ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'}`}
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
                  name={product.name}
                  price={dealPrice}
                  originalPrice={product.price}
                  image={product.image_url}
                  rating={avgRating}
                  reviews={product.reviews?.length || 0}
                  discount={product.deal_discount}
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

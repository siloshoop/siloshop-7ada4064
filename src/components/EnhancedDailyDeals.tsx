import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "./ProductCard";
import { Loader2, Zap, Clock, Flame, ArrowLeft } from "lucide-react";
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

  if (loading) {
    return (
      <section className="py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 via-background to-primary/5" />
        <div className="container px-4 relative z-10">
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
    <section className="py-16 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 via-background to-primary/10" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-destructive/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="container px-4 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-destructive to-destructive/80 shadow-lg shadow-destructive/30">
                <Flame className="h-8 w-8 text-white animate-pulse" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full animate-ping" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-destructive to-primary bg-clip-text text-transparent">
                عروض اليوم الحصرية
              </h2>
              <p className="text-muted-foreground text-lg">خصومات مذهلة لفترة محدودة جداً!</p>
            </div>
          </div>
          
          {/* Countdown Timer */}
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-destructive animate-pulse" />
            <div className="flex gap-2">
              <div className="flex flex-col items-center">
                <div className="bg-gradient-to-b from-destructive to-destructive/80 text-white text-3xl font-bold w-16 h-16 rounded-xl flex items-center justify-center shadow-lg">
                  {String(timeLeft.hours).padStart(2, "0")}
                </div>
                <span className="text-xs text-muted-foreground mt-1">ساعة</span>
              </div>
              <span className="text-3xl font-bold text-destructive self-start mt-3">:</span>
              <div className="flex flex-col items-center">
                <div className="bg-gradient-to-b from-destructive to-destructive/80 text-white text-3xl font-bold w-16 h-16 rounded-xl flex items-center justify-center shadow-lg">
                  {String(timeLeft.minutes).padStart(2, "0")}
                </div>
                <span className="text-xs text-muted-foreground mt-1">دقيقة</span>
              </div>
              <span className="text-3xl font-bold text-destructive self-start mt-3">:</span>
              <div className="flex flex-col items-center">
                <div className="bg-gradient-to-b from-destructive to-destructive/80 text-white text-3xl font-bold w-16 h-16 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
                  {String(timeLeft.seconds).padStart(2, "0")}
                </div>
                <span className="text-xs text-muted-foreground mt-1">ثانية</span>
              </div>
            </div>
          </div>
        </div>

        {/* Deals Banner */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-destructive/20 via-primary/10 to-accent/20 border border-destructive/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className="h-8 w-8 text-yellow-500 animate-bounce" />
            <div>
              <p className="text-lg font-bold">خصومات تصل إلى</p>
              <p className="text-4xl font-black text-destructive">70%</p>
            </div>
          </div>
          <Button 
            size="lg" 
            variant="destructive"
            className="gap-2 shadow-lg shadow-destructive/30"
            onClick={() => navigate("/search?discount=true")}
          >
            تصفح جميع العروض
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const avgRating = product.reviews?.length
              ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
              : 0;
            
            const dealPrice = product.price * (1 - product.deal_discount / 100);

            return (
              <div key={product.id} className="relative">
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 z-10 text-lg px-3 py-1 shadow-lg animate-pulse"
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

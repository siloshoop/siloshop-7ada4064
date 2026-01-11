import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Smartphone, Laptop, Shirt, Home, Dumbbell, Gamepad2, Watch, 
  Baby, Sparkles, BookOpen, Car, Utensils, TrendingUp, ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PopularCategory {
  id: string;
  name_ar: string;
  icon: string;
  product_count: number;
}

const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
  "smartphone": Smartphone,
  "laptop": Laptop,
  "shirt": Shirt,
  "home": Home,
  "dumbbell": Dumbbell,
  "gamepad": Gamepad2,
  "watch": Watch,
  "baby": Baby,
  "sparkles": Sparkles,
  "book": BookOpen,
  "car": Car,
  "utensils": Utensils,
};

const categoryColors: { [key: string]: string } = {
  "الإلكترونيات": "from-blue-500/20 to-cyan-500/20",
  "الملابس والأزياء": "from-pink-500/20 to-rose-500/20",
  "المنزل والحديقة": "from-green-500/20 to-emerald-500/20",
  "الرياضة": "from-orange-500/20 to-amber-500/20",
  "الألعاب": "from-purple-500/20 to-violet-500/20",
  "الساعات": "from-slate-500/20 to-gray-500/20",
  "الأطفال": "from-yellow-500/20 to-lime-500/20",
  "الجمال": "from-fuchsia-500/20 to-pink-500/20",
  "الكتب": "from-indigo-500/20 to-blue-500/20",
  "السيارات": "from-red-500/20 to-orange-500/20",
  "الطعام": "from-teal-500/20 to-green-500/20",
};

const PopularCategories = () => {
  const [categories, setCategories] = useState<PopularCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();

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
    fetchPopularCategories();
  }, []);

  const fetchPopularCategories = async () => {
    try {
      // جلب الفئات مع عدد المنتجات
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name_ar, icon");

      if (categoriesError) throw categoriesError;

      // جلب عدد المنتجات لكل فئة
      const categoriesWithCount = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { count } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("category_id", category.id)
            .eq("is_active", true);

          return {
            ...category,
            product_count: count || 0,
          };
        })
      );

      // ترتيب حسب عدد المنتجات وأخذ أول 8
      const sortedCategories = categoriesWithCount
        .sort((a, b) => b.product_count - a.product_count)
        .slice(0, 8);

      setCategories(sortedCategories);
    } catch (error) {
      console.error("Error fetching popular categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIconComponent = (iconName: string) => {
    return iconMap[iconName] || Smartphone;
  };

  const getCategoryColor = (name: string) => {
    return categoryColors[name] || "from-primary/20 to-primary/10";
  };

  const scroll = (direction: "left" | "right") => {
    const container = document.getElementById("popular-categories-container");
    if (container) {
      const scrollAmount = direction === "left" ? -300 : 300;
      container.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (loading) {
    return (
      <section className="py-8 bg-muted/30">
        <div className="container px-4">
          <div className="flex items-center gap-2 mb-6">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (categories.length === 0) return null;

  return (
    <section 
      ref={sectionRef}
      className={`py-8 bg-muted/30 transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="container px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold">الفئات الأكثر شعبية</h2>
              <p className="text-sm text-muted-foreground">اكتشف الفئات الأكثر طلباً</p>
            </div>
          </div>
          <div className="hidden md:flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("right")}
              className="rounded-full"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("left")}
              className="rounded-full"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          id="popular-categories-container"
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {categories.map((category, index) => {
            const IconComponent = getIconComponent(category.icon);
            return (
              <Card
                key={category.id}
                className={`min-w-[160px] md:min-w-[200px] cursor-pointer transition-all duration-500 hover:scale-105 hover:shadow-lg border-0 bg-gradient-to-br ${getCategoryColor(category.name_ar)} ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: isVisible ? `${index * 100}ms` : "0ms" }}
                onClick={() => navigate(`/category/${category.id}`)}
              >
                <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="p-4 rounded-full bg-background/80 backdrop-blur-sm shadow-sm">
                    <IconComponent className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{category.name_ar}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {category.product_count} منتج
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PopularCategories;

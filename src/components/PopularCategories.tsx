import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Smartphone, Laptop, Shirt, Home, Dumbbell, Gamepad2, Watch, 
  Baby, Sparkles, BookOpen, Car, Utensils, TrendingUp, Footprints,
  ShoppingBag, Trophy, Sofa, Gem, Monitor, Package
} from "lucide-react";

interface PopularCategory {
  id: string;
  name_ar: string;
  icon: string;
  product_count?: number;
}

const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
  Smartphone, Laptop, Shirt, Home, Dumbbell, Gamepad2, Watch,
  Baby, Sparkles, BookOpen, Car, Utensils, Footprints,
  ShoppingBag, Trophy, Sofa, Gem, Monitor, Package,
  smartphone: Smartphone, laptop: Laptop, shirt: Shirt, home: Home,
  dumbbell: Dumbbell, gamepad: Gamepad2, watch: Watch, baby: Baby,
  sparkles: Sparkles, book: BookOpen, car: Car, utensils: Utensils,
};

const categoryColorsByIndex = [
  { bg: "from-blue-500/15 to-cyan-500/15", icon: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/20" },
  { bg: "from-pink-500/15 to-rose-500/15", icon: "text-pink-600 dark:text-pink-400", ring: "ring-pink-500/20" },
  { bg: "from-green-500/15 to-emerald-500/15", icon: "text-green-600 dark:text-green-400", ring: "ring-green-500/20" },
  { bg: "from-orange-500/15 to-amber-500/15", icon: "text-orange-600 dark:text-orange-400", ring: "ring-orange-500/20" },
  { bg: "from-purple-500/15 to-violet-500/15", icon: "text-purple-600 dark:text-purple-400", ring: "ring-purple-500/20" },
  { bg: "from-fuchsia-500/15 to-pink-500/15", icon: "text-fuchsia-600 dark:text-fuchsia-400", ring: "ring-fuchsia-500/20" },
  { bg: "from-indigo-500/15 to-blue-500/15", icon: "text-indigo-600 dark:text-indigo-400", ring: "ring-indigo-500/20" },
  { bg: "from-teal-500/15 to-green-500/15", icon: "text-teal-600 dark:text-teal-400", ring: "ring-teal-500/20" },
];

const demoCategories: PopularCategory[] = [
  { id: "demo-1", name_ar: "هواتف ذكية", icon: "Smartphone", product_count: 128 },
  { id: "demo-2", name_ar: "لابتوبات", icon: "Laptop", product_count: 95 },
  { id: "demo-3", name_ar: "أزياء", icon: "Shirt", product_count: 214 },
  { id: "demo-4", name_ar: "المنزل", icon: "Home", product_count: 76 },
  { id: "demo-5", name_ar: "رياضة", icon: "Dumbbell", product_count: 63 },
  { id: "demo-6", name_ar: "ألعاب", icon: "Gamepad2", product_count: 152 },
  { id: "demo-7", name_ar: "ساعات", icon: "Watch", product_count: 47 },
  { id: "demo-8", name_ar: "أطفال", icon: "Baby", product_count: 89 },
];

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
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchPopularCategories();
  }, []);

  const fetchPopularCategories = async () => {
    try {
      const { data: categoriesData, error } = await supabase
        .from("categories")
        .select("id, name_ar, icon");

      if (error) throw error;

      if (categoriesData && categoriesData.length > 0) {
        // Fetch product counts per category
        const withCounts = await Promise.all(
          categoriesData.slice(0, 8).map(async (cat) => {
            const { count } = await supabase
              .from("products")
              .select("id", { count: "exact", head: true })
              .eq("category_id", cat.id)
              .eq("is_active", true);
            return { ...cat, product_count: count || 0 };
          })
        );
        // Sort by product count descending
        withCounts.sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
        setCategories(withCounts);
      } else {
        setCategories(demoCategories);
      }
    } catch (error) {
      console.error("Error fetching popular categories:", error);
      setCategories(demoCategories);
    } finally {
      setLoading(false);
    }
  };

  const getIconComponent = (iconName: string) => {
    return iconMap[iconName] || iconMap[iconName?.toLowerCase()] || Package;
  };

  if (loading) {
    return (
      <section className="py-6 bg-muted/30">
        <div className="container px-4">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-5 w-5 rounded-md" />
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const displayCategories = categories.length > 0 ? categories : demoCategories;

  return (
    <section 
      ref={sectionRef}
      className="py-6 bg-muted/30"
      style={{ opacity: 1 }}
    >
      <div className="container px-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base md:text-lg font-bold text-foreground">الفئات الأكثر شعبية</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {displayCategories.map((category, index) => {
            const IconComponent = getIconComponent(category.icon);
            const colors = categoryColorsByIndex[index % categoryColorsByIndex.length];
            const isDemo = category.id.startsWith("demo-");
            return (
              <Card
                key={category.id}
                className={`group cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-lg border border-border/50 hover:${colors.ring} bg-gradient-to-br ${colors.bg} backdrop-blur-sm overflow-hidden ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: isVisible ? `${index * 60}ms` : "0ms" }}
                onClick={() => !isDemo && navigate(`/category/${category.id}`)}
              >
                <CardContent className="p-4 flex items-center gap-3 rtl:flex-row-reverse">
                  <div className="p-2.5 rounded-xl bg-background/80 backdrop-blur-sm shadow-sm group-hover:shadow-md transition-shadow duration-300 shrink-0">
                    <IconComponent className={`h-6 w-6 ${colors.icon} transition-transform duration-300 group-hover:scale-110`} />
                  </div>
                  <div className="min-w-0 text-right flex-1">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-1">{category.name_ar}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {category.product_count ?? 0} منتج
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

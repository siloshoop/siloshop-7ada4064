import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Smartphone, Laptop, Shirt, Home, Dumbbell, Gamepad2, Watch, 
  Baby, Sparkles, BookOpen, Car, Utensils, TrendingUp, Footprints,
  ShoppingBag, Trophy, Sofa, Gem, Monitor, Package, ChevronDown,
  Brush, Droplet, Scissors, Sparkle, Hand, Bath, Book, BookMarked,
  PenTool, Users, ChefHat, Activity, Bike, Waves, PersonStanding,
  Briefcase, Mountain, Flower2, Wind, Crown, Moon, Heart, Snowflake,
  Palette, CircleDot, Layers, Award, Bed, HeartPulse, Cloud, User,
  Smile, Star, School, Clock, Diamond, Glasses, Wallet, Backpack,
  Plane, GraduationCap, Tv, BedDouble, UtensilsCrossed, TreePine,
  Gamepad, Dice1, Puzzle, Lightbulb, TreeDeciduous, Cat, X
} from "lucide-react";

interface PopularCategory {
  id: string;
  name_ar: string;
  icon: string;
  product_count?: number;
}

interface Subcategory {
  id: string;
  category_id: string;
  name_ar: string;
  icon: string | null;
}

const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
  Smartphone, Laptop, Shirt, Home, Dumbbell, Gamepad2, Watch,
  Baby, Sparkles, BookOpen, Car, Utensils, Footprints,
  ShoppingBag, Trophy, Sofa, Gem, Monitor, Package,
  smartphone: Smartphone, laptop: Laptop, shirt: Shirt, home: Home,
  dumbbell: Dumbbell, gamepad: Gamepad2, watch: Watch, baby: Baby,
  sparkles: Sparkles, book: BookOpen, car: Car, utensils: Utensils,
};

const subIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "sneakers": PersonStanding, "formal-shoes": Briefcase, "sandals": Footprints,
  "boots": Mountain, "slippers": Home, "heels": Gem,
  "dresses": Flower2, "abayas": Wind, "blouses": Crown,
  "pants-women": Scissors, "skirts": Moon, "pajamas-women": Moon,
  "underwear-women": Heart, "sportswear-women": HeartPulse, "coats-women": Snowflake,
  "hijab": Palette, "shirts": Shirt, "t-shirts": CircleDot,
  "pants-men": Layers, "suits": Award, "jeans": Layers,
  "pajamas-men": Bed, "underwear-men": Heart, "sportswear-men": HeartPulse,
  "coats-men": Cloud, "thobe": User, "baby-clothes": Baby,
  "boys-clothes": Smile, "girls-clothes": Star, "kids-shoes": Footprints,
  "kids-pajamas": Moon, "school-uniforms": School, "kids-sportswear": Trophy,
  "watches": Clock, "jewelry": Diamond, "sunglasses": Glasses,
  "belts": Layers, "scarves": Wind, "hats": GraduationCap, "wallets": Wallet,
  "handbags": ShoppingBag, "backpacks": Backpack, "travel-bags": Plane,
  "laptop-bags": Laptop, "clutches": Star, "school-bags": GraduationCap,
  "living-room": Tv, "bedroom": BedDouble, "dining-room": UtensilsCrossed,
  "office-furniture": Monitor, "kids-furniture": Baby, "outdoor-furniture": TreePine,
  "video-games": Gamepad, "board-games": Dice1, "toys-kids": Puzzle,
  "educational-toys": Lightbulb, "outdoor-toys": TreeDeciduous, "dolls": Cat,
  "makeup": Brush, "skincare": Droplet, "haircare": Scissors,
  "perfumes": Sparkle, "nail-care": Hand, "body-care": Bath,
  "novels": Book, "religious": BookMarked, "educational": PenTool,
  "children-books": Baby, "self-development": Users, "cooking-books": ChefHat,
  "gym-equipment": Dumbbell, "sports-clothes": Shirt, "sports-shoes": Footprints,
  "football": Activity, "swimming": Waves, "cycling": Bike,
};

const categoryColors = [
  { bg: "from-blue-500/15 to-cyan-500/15", icon: "text-blue-600 dark:text-blue-400", ring: "group-hover:ring-blue-500/30" },
  { bg: "from-pink-500/15 to-rose-500/15", icon: "text-pink-600 dark:text-pink-400", ring: "group-hover:ring-pink-500/30" },
  { bg: "from-green-500/15 to-emerald-500/15", icon: "text-green-600 dark:text-green-400", ring: "group-hover:ring-green-500/30" },
  { bg: "from-orange-500/15 to-amber-500/15", icon: "text-orange-600 dark:text-orange-400", ring: "group-hover:ring-orange-500/30" },
  { bg: "from-purple-500/15 to-violet-500/15", icon: "text-purple-600 dark:text-purple-400", ring: "group-hover:ring-purple-500/30" },
  { bg: "from-fuchsia-500/15 to-pink-500/15", icon: "text-fuchsia-600 dark:text-fuchsia-400", ring: "group-hover:ring-fuchsia-500/30" },
  { bg: "from-indigo-500/15 to-blue-500/15", icon: "text-indigo-600 dark:text-indigo-400", ring: "group-hover:ring-indigo-500/30" },
  { bg: "from-teal-500/15 to-green-500/15", icon: "text-teal-600 dark:text-teal-400", ring: "group-hover:ring-teal-500/30" },
  { bg: "from-red-500/15 to-orange-500/15", icon: "text-red-600 dark:text-red-400", ring: "group-hover:ring-red-500/30" },
  { bg: "from-cyan-500/15 to-sky-500/15", icon: "text-cyan-600 dark:text-cyan-400", ring: "group-hover:ring-cyan-500/30" },
  { bg: "from-amber-500/15 to-yellow-500/15", icon: "text-amber-600 dark:text-amber-400", ring: "group-hover:ring-amber-500/30" },
  { bg: "from-emerald-500/15 to-teal-500/15", icon: "text-emerald-600 dark:text-emerald-400", ring: "group-hover:ring-emerald-500/30" },
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
  const [categories, setCategories] = useState<PopularCategory[]>(demoCategories);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPopularCategories();
  }, []);

  const fetchPopularCategories = async () => {
    try {
      console.log("[PopularCategories] Fetching categories...");
      const { data: categoriesData, error } = await supabase
        .from("categories")
        .select("id, name_ar, icon");

      if (error) {
        console.error("[PopularCategories] Supabase error:", error);
        throw error;
      }

      console.log("[PopularCategories] Fetched:", categoriesData?.length, "categories");

      if (categoriesData && categoriesData.length > 0) {
        const withCounts = await Promise.all(
          categoriesData.map(async (cat) => {
            const { count } = await supabase
              .from("products")
              .select("id", { count: "exact", head: true })
              .eq("category_id", cat.id)
              .eq("is_active", true);
            return { ...cat, product_count: count || 0 };
          })
        );
        withCounts.sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
        setCategories(withCounts);
      } else {
        console.log("[PopularCategories] No categories found, using demo data");
        setCategories(demoCategories);
      }
    } catch (error) {
      console.error("[PopularCategories] Error:", error);
      setCategories(demoCategories);
    } finally {
      setLoading(false);
    }
  };

  const getIconComponent = (iconName: string) => {
    return iconMap[iconName] || iconMap[iconName?.toLowerCase()] || Package;
  };

  const displayCategories = categories.length > 0 ? categories : demoCategories;

  if (loading) {
    return (
      <section className="py-8 bg-muted/30">
        <div className="container px-4">
          <div className="flex items-center gap-2 mb-5">
            <Skeleton className="h-5 w-5 rounded-md" />
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 bg-muted/30">
      <div className="container px-4">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base md:text-lg font-bold text-foreground">الفئات الأكثر شعبية</h2>
          <span className="text-xs text-muted-foreground mr-auto">({displayCategories.length} فئة)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {displayCategories.map((category, index) => {
            const IconComponent = getIconComponent(category.icon);
            const colors = categoryColors[index % categoryColors.length];
            const isDemo = category.id.startsWith("demo-");
            return (
              <Card
                key={category.id}
                className={`group cursor-pointer transition-all duration-300 hover:scale-[1.05] hover:-translate-y-1 hover:shadow-xl border border-border/50 bg-gradient-to-br ${colors.bg} backdrop-blur-sm overflow-hidden ring-2 ring-transparent ${colors.ring}`}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => !isDemo && navigate(`/category/${category.id}`)}
              >
                <CardContent className="p-3 sm:p-4 flex flex-col items-center gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-background/80 backdrop-blur-sm shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:scale-110">
                    <IconComponent className={`h-6 w-6 ${colors.icon} transition-transform duration-300`} />
                  </div>
                  <div className="min-w-0 w-full">
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

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { measureFrames } from "@/lib/perfMonitor";
import { useCategoryCardPress } from "@/hooks/useCategoryCardPress";
import { CategoryCardItem } from "@/components/CategoryCardItem";
import { 
  Smartphone, Laptop, Shirt, Home, Dumbbell, Gamepad2, Watch, 
  Baby, Sparkles, BookOpen, Car, Utensils, TrendingUp, Footprints,
  ShoppingBag, Trophy, Sofa, Gem, Monitor, Package, ChevronDown,
  Brush, Droplet, Scissors, Sparkle, Hand, Bath, Book, BookMarked,
  PenTool, Users, ChefHat, Activity, Bike, Waves, PersonStanding,
  Briefcase, Mountain, Flower2, Wind, Crown, Moon, Heart, Snowflake,
  Palette, CircleDot, Layers, Award, Bed, HeartPulse, Cloud, User,
  Smile, Star, School, Clock, Diamond, Glasses, Wallet, Backpack, Search,
  Plane, GraduationCap, Tv, BedDouble, UtensilsCrossed, TreePine,
  Gamepad, Dice1, Puzzle, Lightbulb, TreeDeciduous, Cat, X
} from "lucide-react";
import { Input } from "@/components/ui/input";

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
  // small subcomponent declared via const below
  const [categories, setCategories] = useState<PopularCategory[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchPopularCategories();
  }, []);

  // Sample frame timings once after first paint to log card animation smoothness
  useEffect(() => {
    if (loading) return;
    const id = window.setTimeout(() => {
      measureFrames("popular-categories-mount", 1000);
    }, 50);
    return () => window.clearTimeout(id);
  }, [loading]);

  const fetchPopularCategories = async () => {
    try {
      const [categoriesRes, subcategoriesRes, productsRes] = await Promise.all([
        supabase.from("categories").select("id, name_ar, icon"),
        supabase
          .from("subcategories")
          .select("id, category_id, name_ar, icon")
          .eq("is_active", true)
          .order("sort_order"),
        supabase.from("products").select("category_id").eq("is_active", true),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;

      if (categoriesRes.data && categoriesRes.data.length > 0) {
        const counts = (productsRes.data || []).reduce((acc: Record<string, number>, p) => {
          if (p.category_id) acc[p.category_id] = (acc[p.category_id] || 0) + 1;
          return acc;
        }, {});

        const withCounts = categoriesRes.data.map(cat => ({
          ...cat,
          product_count: counts[cat.id] || 0
        }));

        withCounts.sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
        setCategories(withCounts);
      } else {
        setCategories(demoCategories);
      }

      if (subcategoriesRes.data) {
        setSubcategories(subcategoriesRes.data);
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

  const getSubIconComponent = (iconName: string | null) => {
    if (!iconName) return Package;
    return subIconMap[iconName] || iconMap[iconName] || Package;
  };

  const getCategorySubcategories = (categoryId: string) => {
    return subcategories.filter((s) => s.category_id === categoryId);
  };

  const handleCategoryClick = (categoryId: string, isDemo: boolean) => {
    if (isDemo) return;
    const subs = getCategorySubcategories(categoryId);
    if (subs.length > 0) {
      setExpandedCategoryId(expandedCategoryId === categoryId ? null : categoryId);
    } else {
      navigate(`/category/${categoryId}`);
    }
  };

  const baseCategories = categories.length > 0 ? categories : demoCategories;
  const displayCategories = searchTerm
    ? baseCategories.filter((c) => c.name_ar.includes(searchTerm.trim()))
    : baseCategories;

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
              <div
                key={i}
                className="rounded-xl border border-border/50 bg-card/60 p-3 sm:p-4 flex flex-col items-center gap-2"
                aria-hidden="true"
              >
                <Skeleton className="h-11 w-11 rounded-xl" />
                <Skeleton className="h-3.5 w-20 rounded" />
                <Skeleton className="h-3 w-12 rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const expandedCategory = expandedCategoryId
    ? displayCategories.find((c) => c.id === expandedCategoryId)
    : null;
  const expandedSubs = expandedCategoryId
    ? getCategorySubcategories(expandedCategoryId)
    : [];
  const expandedColorIndex = expandedCategory
    ? displayCategories.indexOf(expandedCategory)
    : 0;

  return (
    <section className="py-8 bg-muted/30">
      <div className="container px-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-transparent border border-primary/15 p-4 md:p-5 mb-5">
          <h2 className="text-lg md:text-xl font-bold text-foreground mb-1">
            تصفّح فئات المتجر
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mb-3">
            اكتشف آلاف المنتجات من فئات متنوعة بأفضل الأسعار
          </p>
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث في الفئات..."
              className="pr-9 bg-background/80"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base md:text-lg font-bold text-foreground">الفئات الأكثر شعبية</h2>
          <span className="text-xs text-muted-foreground mr-auto">({displayCategories.length} فئة)</span>
        </div>

        {displayCategories.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            لا توجد فئات مطابقة للبحث
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 stagger-children">
          {displayCategories.map((category, index) => {
            const IconComponent = getIconComponent(category.icon);
            const colors = categoryColors[index % categoryColors.length];
            const isDemo = category.id.startsWith("demo-");
            const isExpanded = expandedCategoryId === category.id;
            const hasSubs = getCategorySubcategories(category.id).length > 0;

            return (
              <CategoryCardItem
                key={category.id}
                category={category}
                colors={colors}
                isExpanded={isExpanded}
                hasSubs={hasSubs}
                index={index}
                IconComponent={IconComponent}
                onActivate={() => handleCategoryClick(category.id, isDemo)}
              />
            );
          })}
        </div>

        {/* Subcategories Panel */}
        {expandedCategoryId && expandedSubs.length > 0 && expandedCategory && (
          <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-300">
            <Card className="border border-primary/20 bg-gradient-to-br from-muted/50 to-background shadow-lg overflow-hidden">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg bg-gradient-to-br ${categoryColors[expandedColorIndex % categoryColors.length].bg}`}>
                      {(() => {
                        const Icon = getIconComponent(expandedCategory.icon);
                        return <Icon className={`h-4 w-4 ${categoryColors[expandedColorIndex % categoryColors.length].icon}`} />;
                      })()}
                    </div>
                    <h3 className="font-bold text-foreground">{expandedCategory.name_ar}</h3>
                    <span className="text-xs text-muted-foreground">({expandedSubs.length} تصنيف فرعي)</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/category/${expandedCategoryId}`)}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      عرض الكل
                    </button>
                    <button
                      onClick={() => setExpandedCategoryId(null)}
                      className="p-1 rounded-full hover:bg-muted transition-colors"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {expandedSubs.map((sub, i) => {
                    const SubIcon = getSubIconComponent(sub.icon);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => navigate(`/subcategory/${expandedCategoryId}/${sub.id}`)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-background hover:bg-primary hover:text-primary-foreground border border-border/50 hover:border-primary transition-all duration-200 hover:shadow-md hover:scale-[1.02] text-sm"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <SubIcon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{sub.name_ar}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularCategories;

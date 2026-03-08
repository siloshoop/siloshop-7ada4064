import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { 
  Shirt, UserCircle, Baby, Watch, Footprints, ShoppingBag, Sparkles, Loader2,
  Sofa, Gamepad2, Sparkle, BookOpen, Dumbbell, ChevronDown, ChevronUp,
  PersonStanding, Briefcase, Mountain, Home, Gem, Flower2, Wind, Crown, 
  Scissors, Moon, Heart, Snowflake, Palette, CircleDot, Award, Layers, 
  Bed, HeartPulse, Cloud, User, Smile, Star, School, Trophy, Clock, 
  Diamond, Glasses, Wallet, Backpack, Plane, Laptop, GraduationCap, Tv, 
  BedDouble, UtensilsCrossed, Monitor, TreePine, Gamepad, Dice1, Puzzle, 
  Lightbulb, TreeDeciduous, Cat, Brush, Droplet, CircleUser, Hand, Bath, 
  Book, BookMarked, PenTool, Users, ChefHat, Activity, Bike, Waves
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const iconMap: Record<string, any> = {
  Shirt, UserCircle, Baby, Watch, Footprints, ShoppingBag,
  Sofa, Gamepad2, Sparkle, BookOpen, Dumbbell,
};

// Subcategory icons mapping
const subIconMap: Record<string, any> = {
  // Shoes
  "sneakers": PersonStanding,
  "formal-shoes": Briefcase,
  "sandals": Footprints,
  "boots": Mountain,
  "slippers": Home,
  "heels": Gem,
  // Women clothing
  "dresses": Flower2,
  "abayas": Wind,
  "blouses": Crown,
  "pants-women": Scissors,
  "skirts": Moon,
  "pajamas-women": Moon,
  "underwear-women": Heart,
  "sportswear-women": HeartPulse,
  "coats-women": Snowflake,
  "hijab": Palette,
  // Men clothing
  "shirts": Shirt,
  "t-shirts": CircleDot,
  "pants-men": Layers,
  "suits": Award,
  "jeans": Layers,
  "pajamas-men": Bed,
  "underwear-men": Heart,
  "sportswear-men": HeartPulse,
  "coats-men": Cloud,
  "thobe": User,
  // Kids
  "baby-clothes": Baby,
  "boys-clothes": Smile,
  "girls-clothes": Star,
  "kids-shoes": Footprints,
  "kids-pajamas": Moon,
  "school-uniforms": School,
  "kids-sportswear": Trophy,
  // Accessories
  "watches": Clock,
  "jewelry": Diamond,
  "sunglasses": Glasses,
  "belts": Layers,
  "scarves": Wind,
  "hats": GraduationCap,
  "wallets": Wallet,
  // Bags
  "handbags": ShoppingBag,
  "backpacks": Backpack,
  "travel-bags": Plane,
  "laptop-bags": Laptop,
  "clutches": Star,
  "school-bags": GraduationCap,
  // Furniture
  "living-room": Tv,
  "bedroom": BedDouble,
  "dining-room": UtensilsCrossed,
  "office-furniture": Monitor,
  "kids-furniture": Baby,
  "outdoor-furniture": TreePine,
  // Games
  "video-games": Gamepad,
  "board-games": Dice1,
  "toys-kids": Puzzle,
  "educational-toys": Lightbulb,
  "outdoor-toys": TreeDeciduous,
  "dolls": Cat,
  // Beauty
  "makeup": Brush,
  "skincare": Droplet,
  "haircare": Scissors,
  "perfumes": Sparkle,
  "nail-care": Hand,
  "body-care": Bath,
  // Books
  "novels": Book,
  "religious": BookMarked,
  "educational": PenTool,
  "children-books": Baby,
  "self-development": Users,
  "cooking-books": ChefHat,
  // Sports
  "gym-equipment": Dumbbell,
  "sports-clothes": Shirt,
  "sports-shoes": Footprints,
  "football": Activity,
  "swimming": Waves,
  "cycling": Bike,
};

interface Category {
  id: string;
  name_ar: string;
  icon: string | null;
  description: string | null;
}

interface Subcategory {
  id: string;
  category_id: string;
  name_ar: string;
  icon: string | null;
}

interface SubCategoryLocal {
  id: string;
  name: string;
  icon: string;
}

// Default subcategories mapping
const defaultSubcategoriesMap: Record<string, SubCategoryLocal[]> = {
  "أحذية": [
    { id: "sneakers", name: "أحذية رياضية", icon: "sneakers" },
    { id: "formal-shoes", name: "أحذية رسمية", icon: "formal-shoes" },
    { id: "sandals", name: "صنادل", icon: "sandals" },
    { id: "boots", name: "بوط", icon: "boots" },
    { id: "slippers", name: "شباشب", icon: "slippers" },
    { id: "heels", name: "كعب عالي", icon: "heels" },
  ],
  "ملابس نساء": [
    { id: "dresses", name: "فساتين", icon: "dresses" },
    { id: "abayas", name: "عباءات", icon: "abayas" },
    { id: "blouses", name: "بلوزات", icon: "blouses" },
    { id: "pants-women", name: "بناطيل", icon: "pants-women" },
    { id: "skirts", name: "تنانير", icon: "skirts" },
    { id: "pajamas-women", name: "بيجامات", icon: "pajamas-women" },
    { id: "underwear-women", name: "ملابس داخلية", icon: "underwear-women" },
    { id: "sportswear-women", name: "ملابس رياضية", icon: "sportswear-women" },
    { id: "coats-women", name: "معاطف وجاكيتات", icon: "coats-women" },
    { id: "hijab", name: "حجابات وطرح", icon: "hijab" },
  ],
  "ملابس رجال": [
    { id: "shirts", name: "قمصان", icon: "shirts" },
    { id: "t-shirts", name: "تيشيرتات", icon: "t-shirts" },
    { id: "pants-men", name: "بناطيل", icon: "pants-men" },
    { id: "suits", name: "بدلات رسمية", icon: "suits" },
    { id: "jeans", name: "جينز", icon: "jeans" },
    { id: "pajamas-men", name: "بيجامات", icon: "pajamas-men" },
    { id: "underwear-men", name: "ملابس داخلية", icon: "underwear-men" },
    { id: "sportswear-men", name: "ملابس رياضية", icon: "sportswear-men" },
    { id: "coats-men", name: "معاطف وجاكيتات", icon: "coats-men" },
    { id: "thobe", name: "جلابيات وثياب", icon: "thobe" },
  ],
  "أطفال": [
    { id: "baby-clothes", name: "ملابس رضع", icon: "baby-clothes" },
    { id: "boys-clothes", name: "ملابس أولاد", icon: "boys-clothes" },
    { id: "girls-clothes", name: "ملابس بنات", icon: "girls-clothes" },
    { id: "kids-shoes", name: "أحذية أطفال", icon: "kids-shoes" },
    { id: "kids-pajamas", name: "بيجامات أطفال", icon: "kids-pajamas" },
    { id: "school-uniforms", name: "زي مدرسي", icon: "school-uniforms" },
    { id: "kids-sportswear", name: "ملابس رياضية", icon: "kids-sportswear" },
  ],
  "إكسسوارات": [
    { id: "watches", name: "ساعات", icon: "watches" },
    { id: "jewelry", name: "مجوهرات", icon: "jewelry" },
    { id: "sunglasses", name: "نظارات شمسية", icon: "sunglasses" },
    { id: "belts", name: "أحزمة", icon: "belts" },
    { id: "scarves", name: "أوشحة", icon: "scarves" },
    { id: "hats", name: "قبعات", icon: "hats" },
    { id: "wallets", name: "محافظ", icon: "wallets" },
  ],
  "حقائب": [
    { id: "handbags", name: "حقائب يد", icon: "handbags" },
    { id: "backpacks", name: "حقائب ظهر", icon: "backpacks" },
    { id: "travel-bags", name: "حقائب سفر", icon: "travel-bags" },
    { id: "laptop-bags", name: "حقائب لابتوب", icon: "laptop-bags" },
    { id: "clutches", name: "كلاتش", icon: "clutches" },
    { id: "school-bags", name: "حقائب مدرسية", icon: "school-bags" },
  ],
  "أثاث": [
    { id: "living-room", name: "غرفة معيشة", icon: "living-room" },
    { id: "bedroom", name: "غرفة نوم", icon: "bedroom" },
    { id: "dining-room", name: "غرفة طعام", icon: "dining-room" },
    { id: "office-furniture", name: "أثاث مكتبي", icon: "office-furniture" },
    { id: "kids-furniture", name: "أثاث أطفال", icon: "kids-furniture" },
    { id: "outdoor-furniture", name: "أثاث خارجي", icon: "outdoor-furniture" },
  ],
  "ألعاب": [
    { id: "video-games", name: "ألعاب فيديو", icon: "video-games" },
    { id: "board-games", name: "ألعاب طاولة", icon: "board-games" },
    { id: "toys-kids", name: "ألعاب أطفال", icon: "toys-kids" },
    { id: "educational-toys", name: "ألعاب تعليمية", icon: "educational-toys" },
    { id: "outdoor-toys", name: "ألعاب خارجية", icon: "outdoor-toys" },
    { id: "dolls", name: "دمى وعرائس", icon: "dolls" },
  ],
  "تجميل": [
    { id: "makeup", name: "مكياج", icon: "makeup" },
    { id: "skincare", name: "عناية بالبشرة", icon: "skincare" },
    { id: "haircare", name: "عناية بالشعر", icon: "haircare" },
    { id: "perfumes", name: "عطور", icon: "perfumes" },
    { id: "nail-care", name: "عناية بالأظافر", icon: "nail-care" },
    { id: "body-care", name: "عناية بالجسم", icon: "body-care" },
  ],
  "كتب": [
    { id: "novels", name: "روايات", icon: "novels" },
    { id: "religious", name: "كتب دينية", icon: "religious" },
    { id: "educational", name: "كتب تعليمية", icon: "educational" },
    { id: "children-books", name: "كتب أطفال", icon: "children-books" },
    { id: "self-development", name: "تطوير ذات", icon: "self-development" },
    { id: "cooking-books", name: "كتب طبخ", icon: "cooking-books" },
  ],
  "رياضة": [
    { id: "gym-equipment", name: "معدات رياضية", icon: "gym-equipment" },
    { id: "sports-clothes", name: "ملابس رياضية", icon: "sports-clothes" },
    { id: "sports-shoes", name: "أحذية رياضية", icon: "sports-shoes" },
    { id: "football", name: "كرة قدم", icon: "football" },
    { id: "swimming", name: "سباحة", icon: "swimming" },
    { id: "cycling", name: "دراجات", icon: "cycling" },
  ],
};

const CategorySection = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [dbSubcategories, setDbSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const isVisible = true;

  useEffect(() => {
    const fetchData = async () => {
      const [categoriesRes, subcategoriesRes] = await Promise.all([
        supabase.from("categories").select("*").order("name_ar"),
        supabase.from("subcategories").select("*").eq("is_active", true).order("sort_order")
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (subcategoriesRes.data) setDbSubcategories(subcategoriesRes.data);
      setLoading(false);
    };

    fetchData();
  }, []);

  const defaultCategories = [
    {
      id: "default-women",
      name: "ملابس نساء",
      icon: "Shirt",
      gradient: "from-pink-500 via-rose-500 to-purple-500",
      bgColor: "bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30",
      iconColor: "text-pink-600"
    },
    {
      id: "default-men",
      name: "ملابس رجال",
      icon: "UserCircle",
      gradient: "from-blue-500 via-indigo-500 to-purple-600",
      bgColor: "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
      iconColor: "text-blue-600"
    },
    {
      id: "default-kids",
      name: "أطفال",
      icon: "Baby",
      gradient: "from-yellow-400 via-orange-400 to-red-400",
      bgColor: "bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30",
      iconColor: "text-orange-600"
    },
    {
      id: "default-accessories",
      name: "إكسسوارات",
      icon: "Watch",
      gradient: "from-emerald-500 via-teal-500 to-cyan-500",
      bgColor: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30",
      iconColor: "text-emerald-600"
    },
    {
      id: "default-shoes",
      name: "أحذية",
      icon: "Footprints",
      gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
      bgColor: "bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-950/30 dark:to-fuchsia-950/30",
      iconColor: "text-violet-600"
    },
    {
      id: "default-bags",
      name: "حقائب",
      icon: "ShoppingBag",
      gradient: "from-amber-500 via-orange-500 to-red-500",
      bgColor: "bg-gradient-to-br from-amber-50 to-red-50 dark:from-amber-950/30 dark:to-red-950/30",
      iconColor: "text-amber-600"
    },
    {
      id: "default-furniture",
      name: "أثاث",
      icon: "Sofa",
      gradient: "from-stone-500 via-neutral-500 to-zinc-500",
      bgColor: "bg-gradient-to-br from-stone-50 to-zinc-50 dark:from-stone-950/30 dark:to-zinc-950/30",
      iconColor: "text-stone-600"
    },
    {
      id: "default-toys",
      name: "ألعاب",
      icon: "Gamepad2",
      gradient: "from-green-500 via-emerald-500 to-teal-500",
      bgColor: "bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950/30 dark:to-teal-950/30",
      iconColor: "text-green-600"
    },
    {
      id: "default-beauty",
      name: "تجميل",
      icon: "Sparkle",
      gradient: "from-fuchsia-500 via-pink-500 to-rose-500",
      bgColor: "bg-gradient-to-br from-fuchsia-50 to-rose-50 dark:from-fuchsia-950/30 dark:to-rose-950/30",
      iconColor: "text-fuchsia-600"
    },
    {
      id: "default-books",
      name: "كتب",
      icon: "BookOpen",
      gradient: "from-cyan-500 via-sky-500 to-blue-500",
      bgColor: "bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30",
      iconColor: "text-cyan-600"
    },
    {
      id: "default-sports",
      name: "رياضة",
      icon: "Dumbbell",
      gradient: "from-red-500 via-orange-500 to-yellow-500",
      bgColor: "bg-gradient-to-br from-red-50 to-yellow-50 dark:from-red-950/30 dark:to-yellow-950/30",
      iconColor: "text-red-600"
    },
  ];

  const displayCategories = categories.length > 0 
    ? categories.map((cat, idx) => ({
        id: cat.id,
        name: cat.name_ar,
        icon: cat.icon || defaultCategories[idx % defaultCategories.length]?.icon || "ShoppingBag",
        gradient: defaultCategories.find(d => d.name === cat.name_ar)?.gradient || defaultCategories[idx % defaultCategories.length]?.gradient || "from-primary to-accent",
        bgColor: defaultCategories.find(d => d.name === cat.name_ar)?.bgColor || defaultCategories[idx % defaultCategories.length]?.bgColor || "bg-muted",
        iconColor: defaultCategories.find(d => d.name === cat.name_ar)?.iconColor || defaultCategories[idx % defaultCategories.length]?.iconColor || "text-primary",
      }))
    : defaultCategories.map(cat => ({ ...cat }));

  const getSubcategories = (categoryId: string, categoryName: string) => {
    // First check DB subcategories
    const dbSubs = dbSubcategories.filter(s => s.category_id === categoryId);
    if (dbSubs.length > 0) {
      return dbSubs.map(s => ({
        id: s.id,
        name: s.name_ar,
        icon: s.icon || "default"
      }));
    }
    // Fallback to default subcategories
    return defaultSubcategoriesMap[categoryName] || [];
  };

  const toggleExpand = (categoryName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategory(expandedCategory === categoryName ? null : categoryName);
  };

  const handleSubcategoryClick = (categoryId: string, subcategoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/subcategory/${categoryId}/${subcategoryId}`);
  };

  if (loading) {
    return (
      <section className="py-8 relative overflow-hidden">
        <div className="container px-4">
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section 
      className="py-8 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
      
      <div className="container px-4 relative z-10">
        <div className={`text-center mb-6 space-y-2 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              تسوق حسب الفئة
            </h2>
            <Sparkles className="w-5 h-5 text-accent animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm md:text-base">
            اكتشف مجموعاتنا المتنوعة من أفضل المنتجات
          </p>
          <div className={`h-0.5 w-16 bg-gradient-to-r from-primary to-accent mx-auto rounded-full transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} />
        </div>
        
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
          {displayCategories.map((category, index) => {
            const IconComponent = iconMap[category.icon] || ShoppingBag;
            const subcategories = getSubcategories(category.id, category.name);
            const isExpanded = expandedCategory === category.name;
            
            return (
              <Card
                key={category.id}
                className={cn(
                  `group cursor-pointer overflow-hidden border-2 border-transparent hover:border-primary/30 shadow-lg hover:shadow-2xl transition-all duration-500`,
                  category.bgColor,
                  isExpanded && "col-span-2 row-span-2",
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                )}
                style={{ transitionDelay: `${200 + index * 50}ms` }}
                onClick={() => navigate(`/category/${category.id}`)}
              >
                <div className={cn(
                  "relative p-3 md:p-4 flex flex-col items-center justify-start text-center",
                  isExpanded ? "min-h-[280px]" : "aspect-square"
                )}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                  
                  <div className="relative z-10 space-y-3 w-full">
                    <div className="flex items-center justify-center gap-2">
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br ${category.gradient} p-0.5 group-hover:scale-110 transition-all duration-500 shadow-lg`}>
                        <div className="w-full h-full bg-background rounded-xl flex items-center justify-center">
                          <IconComponent className={`w-5 h-5 md:w-6 md:h-6 ${category.iconColor} group-hover:scale-110 transition-transform duration-300`} />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-sm md:text-base mb-1 group-hover:text-primary transition-colors">
                        {category.name}
                      </h3>
                    </div>

                    {subcategories.length > 0 && (
                      <button
                        onClick={(e) => toggleExpand(category.name, e)}
                        className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mx-auto"
                      >
                        <span>{isExpanded ? "إخفاء" : "عرض"} التصنيفات ({subcategories.length})</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}

                    {isExpanded && subcategories.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-2 animate-fade-in">
                        {subcategories.map((sub) => {
                          const SubIcon = subIconMap[sub.icon] || ShoppingBag;
                          return (
                            <button
                              key={sub.id}
                              onClick={(e) => handleSubcategoryClick(category.id, sub.id, e)}
                              className={cn(
                                "flex items-center gap-2 text-xs md:text-sm px-3 py-2 rounded-lg transition-all duration-200",
                                "bg-background/80 hover:bg-primary hover:text-primary-foreground",
                                "border border-border/50 hover:border-primary",
                                "text-foreground/80 hover:shadow-md"
                              )}
                            >
                              <SubIcon className="w-4 h-4 shrink-0" />
                              <span className="truncate">{sub.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${category.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500`} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategorySection;

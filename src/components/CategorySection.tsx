import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { 
  Shirt, UserCircle, Baby, Watch, Footprints, ShoppingBag, Sparkles, Loader2,
  Sofa, Gamepad2, Sparkle, BookOpen, Dumbbell, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, any> = {
  Shirt,
  UserCircle,
  Baby,
  Watch,
  Footprints,
  ShoppingBag,
  Sofa,
  Gamepad2,
  Sparkle,
  BookOpen,
  Dumbbell,
};

interface Category {
  id: string;
  name_ar: string;
  icon: string | null;
  description: string | null;
}

interface SubCategory {
  id: string;
  name: string;
}

// Subcategories mapping for each main category
const subcategoriesMap: Record<string, SubCategory[]> = {
  "أحذية": [
    { id: "sneakers", name: "أحذية رياضية" },
    { id: "formal-shoes", name: "أحذية رسمية" },
    { id: "sandals", name: "صنادل" },
    { id: "boots", name: "بوط" },
    { id: "slippers", name: "شباشب" },
    { id: "heels", name: "كعب عالي" },
  ],
  "ملابس نساء": [
    { id: "dresses", name: "فساتين" },
    { id: "abayas", name: "عباءات" },
    { id: "blouses", name: "بلوزات" },
    { id: "pants-women", name: "بناطيل" },
    { id: "skirts", name: "تنانير" },
    { id: "pajamas-women", name: "بيجامات" },
    { id: "underwear-women", name: "ملابس داخلية" },
    { id: "sportswear-women", name: "ملابس رياضية" },
    { id: "coats-women", name: "معاطف وجاكيتات" },
    { id: "hijab", name: "حجابات وطرح" },
  ],
  "ملابس رجال": [
    { id: "shirts", name: "قمصان" },
    { id: "t-shirts", name: "تيشيرتات" },
    { id: "pants-men", name: "بناطيل" },
    { id: "suits", name: "بدلات رسمية" },
    { id: "jeans", name: "جينز" },
    { id: "pajamas-men", name: "بيجامات" },
    { id: "underwear-men", name: "ملابس داخلية" },
    { id: "sportswear-men", name: "ملابس رياضية" },
    { id: "coats-men", name: "معاطف وجاكيتات" },
    { id: "thobe", name: "جلابيات وثياب" },
  ],
  "أطفال": [
    { id: "baby-clothes", name: "ملابس رضع" },
    { id: "boys-clothes", name: "ملابس أولاد" },
    { id: "girls-clothes", name: "ملابس بنات" },
    { id: "kids-shoes", name: "أحذية أطفال" },
    { id: "kids-pajamas", name: "بيجامات أطفال" },
    { id: "school-uniforms", name: "زي مدرسي" },
    { id: "kids-sportswear", name: "ملابس رياضية" },
  ],
  "إكسسوارات": [
    { id: "watches", name: "ساعات" },
    { id: "jewelry", name: "مجوهرات" },
    { id: "sunglasses", name: "نظارات شمسية" },
    { id: "belts", name: "أحزمة" },
    { id: "scarves", name: "أوشحة" },
    { id: "hats", name: "قبعات" },
    { id: "wallets", name: "محافظ" },
  ],
  "حقائب": [
    { id: "handbags", name: "حقائب يد" },
    { id: "backpacks", name: "حقائب ظهر" },
    { id: "travel-bags", name: "حقائب سفر" },
    { id: "laptop-bags", name: "حقائب لابتوب" },
    { id: "clutches", name: "كلاتش" },
    { id: "school-bags", name: "حقائب مدرسية" },
  ],
  "أثاث": [
    { id: "living-room", name: "غرفة معيشة" },
    { id: "bedroom", name: "غرفة نوم" },
    { id: "dining-room", name: "غرفة طعام" },
    { id: "office-furniture", name: "أثاث مكتبي" },
    { id: "kids-furniture", name: "أثاث أطفال" },
    { id: "outdoor-furniture", name: "أثاث خارجي" },
  ],
  "ألعاب": [
    { id: "video-games", name: "ألعاب فيديو" },
    { id: "board-games", name: "ألعاب طاولة" },
    { id: "toys-kids", name: "ألعاب أطفال" },
    { id: "educational-toys", name: "ألعاب تعليمية" },
    { id: "outdoor-toys", name: "ألعاب خارجية" },
    { id: "dolls", name: "دمى وعرائس" },
  ],
  "تجميل": [
    { id: "makeup", name: "مكياج" },
    { id: "skincare", name: "عناية بالبشرة" },
    { id: "haircare", name: "عناية بالشعر" },
    { id: "perfumes", name: "عطور" },
    { id: "nail-care", name: "عناية بالأظافر" },
    { id: "body-care", name: "عناية بالجسم" },
  ],
  "كتب": [
    { id: "novels", name: "روايات" },
    { id: "religious", name: "كتب دينية" },
    { id: "educational", name: "كتب تعليمية" },
    { id: "children-books", name: "كتب أطفال" },
    { id: "self-development", name: "تطوير ذات" },
    { id: "cooking-books", name: "كتب طبخ" },
  ],
  "رياضة": [
    { id: "gym-equipment", name: "معدات رياضية" },
    { id: "sports-clothes", name: "ملابس رياضية" },
    { id: "sports-shoes", name: "أحذية رياضية" },
    { id: "football", name: "كرة قدم" },
    { id: "swimming", name: "سباحة" },
    { id: "cycling", name: "دراجات" },
  ],
};

const CategorySection = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .order("name_ar");

      if (data) {
        setCategories(data);
      }
      setLoading(false);
    };

    fetchCategories();
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

  const toggleExpand = (categoryName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategory(expandedCategory === categoryName ? null : categoryName);
  };

  const handleSubcategoryClick = (categoryId: string, subcategoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/category/${categoryId}?sub=${subcategoryId}`);
  };

  if (loading) {
    return (
      <section className="py-20 relative overflow-hidden">
        <div className="container px-4">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      
      <div className="container px-4 relative z-10">
        <div className="text-center mb-16 space-y-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              تسوق حسب الفئة
            </h2>
            <Sparkles className="w-6 h-6 text-accent animate-pulse" />
          </div>
          <p className="text-muted-foreground text-lg md:text-xl">
            اكتشف مجموعاتنا المتنوعة من أفضل المنتجات
          </p>
          <div className="h-1 w-24 bg-gradient-to-r from-primary to-accent mx-auto rounded-full" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {displayCategories.map((category, index) => {
            const IconComponent = iconMap[category.icon] || ShoppingBag;
            const subcategories = subcategoriesMap[category.name] || [];
            const isExpanded = expandedCategory === category.name;
            
            return (
              <Card
                key={category.id}
                className={cn(
                  `group cursor-pointer overflow-hidden border-2 border-transparent hover:border-primary/30 shadow-lg hover:shadow-2xl transition-all duration-500 animate-fade-in`,
                  category.bgColor,
                  isExpanded && "col-span-2 row-span-2"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => navigate(`/category/${category.id}`)}
              >
                <div className={cn(
                  "relative p-4 md:p-6 flex flex-col items-center justify-start text-center",
                  isExpanded ? "min-h-[300px]" : "aspect-square"
                )}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                  
                  <div className="relative z-10 space-y-3 w-full">
                    <div className="flex items-center justify-center gap-2">
                      <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${category.gradient} p-0.5 group-hover:scale-110 transition-all duration-500 shadow-lg`}>
                        <div className="w-full h-full bg-background rounded-2xl flex items-center justify-center">
                          <IconComponent className={`w-7 h-7 md:w-8 md:h-8 ${category.iconColor} group-hover:scale-110 transition-transform duration-300`} />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-base md:text-lg mb-1 group-hover:text-primary transition-colors">
                        {category.name}
                      </h3>
                    </div>

                    {subcategories.length > 0 && (
                      <button
                        onClick={(e) => toggleExpand(category.name, e)}
                        className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mx-auto"
                      >
                        <span>{isExpanded ? "إخفاء" : "عرض"} التصنيفات</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}

                    {isExpanded && subcategories.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-2 animate-fade-in">
                        {subcategories.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={(e) => handleSubcategoryClick(category.id, sub.id, e)}
                            className={cn(
                              "text-xs md:text-sm px-3 py-2 rounded-lg transition-all duration-200",
                              "bg-background/80 hover:bg-primary hover:text-primary-foreground",
                              "border border-border/50 hover:border-primary",
                              "text-foreground/80 hover:shadow-md"
                            )}
                          >
                            {sub.name}
                          </button>
                        ))}
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

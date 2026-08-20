import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Shirt, ShoppingBag, Watch, Baby, Footprints, Sofa, Gamepad2, Sparkle, BookOpen, Dumbbell, Loader2 } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name_ar: string;
  icon: string | null;
}

interface Subcategory {
  id: string;
  category_id: string;
  name_ar: string;
  icon: string | null;
}

const iconMap: Record<string, any> = {
  Shirt, ShoppingBag, Watch, Baby, Footprints, Sofa, Gamepad2, Sparkle, BookOpen, Dumbbell,
  UserCircle: Shirt,
};


const MegaMenu = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [categoriesRes, subcategoriesRes] = await Promise.all([
        supabase.from("categories").select("*").order("name_ar"),
        supabase.from("subcategories").select("*").eq("is_active", true).order("sort_order")
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (subcategoriesRes.data) setSubcategories(subcategoriesRes.data);
      setLoading(false);
    };

    fetchData();
  }, []);

  const getCategorySubcategories = (categoryId: string) => {
    return subcategories.filter(sub => sub.category_id === categoryId);
  };



  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">جاري التحميل...</span>
      </div>
    );
  }

  return (
    <NavigationMenu className="max-w-none" dir="rtl">
      <NavigationMenuList className="gap-0">
        {categories.slice(0, 8).map((category) => {
          const IconComponent = iconMap[category.icon || "ShoppingBag"] || ShoppingBag;
          const subs = getCategorySubcategories(category.id);
          
          return (
            <NavigationMenuItem key={category.id}>
              <NavigationMenuTrigger
                className="gap-1.5 px-2.5 py-1.5 h-9 bg-transparent hover:bg-accent/10 data-[state=open]:bg-accent/10 text-sm"
                onMouseEnter={() => setActiveCategory(category.id)}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/category/${category.id}`);
                }}
              >
                <IconComponent className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{category.name_ar}</span>
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid gap-3 p-4 w-[500px] lg:w-[650px] grid-cols-[1fr_200px]">
                  {/* Subcategories List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="text-base font-bold text-foreground">{category.name_ar}</h3>
                      <button
                        onClick={() => navigate(`/category/${category.id}`)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        عرض الكل
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
                      {subs.length > 0 ? (
                        subs.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => navigate(`/subcategory/${category.id}/${sub.id}`)}
                            className={cn(
                              "flex items-center gap-1.5 p-2 rounded-md text-right transition-all duration-200",
                              "hover:bg-primary/10 hover:text-primary",
                              "border border-transparent hover:border-primary/20"
                            )}
                          >
                            <span className="text-xs font-medium">{sub.name_ar}</span>
                          </button>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground col-span-full py-3 text-center">
                          لا توجد فئات فرعية
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Category highlight tile — design-system gradient, no external imagery */}
                  <button
                    type="button"
                    className="relative rounded-lg overflow-hidden group h-32 text-right"
                    style={{ background: "var(--gradient-primary)" }}
                    onClick={() => navigate(`/category/${category.id}`)}
                    aria-label={category.name_ar}
                  >
                    <IconComponent className="absolute -bottom-3 -left-3 h-24 w-24 text-primary-foreground/20 transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute bottom-2 right-2 left-2">
                      <p className="text-primary-foreground font-bold text-sm">{category.name_ar}</p>
                      <p className="text-primary-foreground/80 text-xs">اكتشف المزيد</p>
                    </div>
                  </button>

                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
};

export default MegaMenu;

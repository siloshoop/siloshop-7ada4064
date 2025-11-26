import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Shirt, UserCircle, Baby, Watch, Footprints, ShoppingBag, Sparkles, Loader2 } from "lucide-react";

const iconMap: Record<string, any> = {
  Shirt,
  UserCircle,
  Baby,
  Watch,
  Footprints,
  ShoppingBag,
};

interface Category {
  id: string;
  name_ar: string;
  icon: string | null;
  description: string | null;
}

const CategorySection = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

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
      bgColor: "bg-gradient-to-br from-pink-50 to-purple-50",
      iconColor: "text-pink-600"
    },
    {
      id: "default-men",
      name: "ملابس رجال",
      icon: "UserCircle",
      gradient: "from-blue-500 via-indigo-500 to-purple-600",
      bgColor: "bg-gradient-to-br from-blue-50 to-indigo-50",
      iconColor: "text-blue-600"
    },
    {
      id: "default-kids",
      name: "أطفال",
      icon: "Baby",
      gradient: "from-yellow-400 via-orange-400 to-red-400",
      bgColor: "bg-gradient-to-br from-yellow-50 to-orange-50",
      iconColor: "text-orange-600"
    },
    {
      id: "default-accessories",
      name: "إكسسوارات",
      icon: "Watch",
      gradient: "from-emerald-500 via-teal-500 to-cyan-500",
      bgColor: "bg-gradient-to-br from-emerald-50 to-teal-50",
      iconColor: "text-emerald-600"
    },
    {
      id: "default-shoes",
      name: "أحذية",
      icon: "Footprints",
      gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
      bgColor: "bg-gradient-to-br from-violet-50 to-fuchsia-50",
      iconColor: "text-violet-600"
    },
    {
      id: "default-bags",
      name: "حقائب",
      icon: "ShoppingBag",
      gradient: "from-amber-500 via-orange-500 to-red-500",
      bgColor: "bg-gradient-to-br from-amber-50 to-red-50",
      iconColor: "text-amber-600"
    }
  ];

  const displayCategories = categories.length > 0 
    ? categories.map((cat, idx) => ({
        id: cat.id,
        name: cat.name_ar,
        icon: cat.icon || defaultCategories[idx % defaultCategories.length]?.icon || "ShoppingBag",
        gradient: defaultCategories[idx % defaultCategories.length]?.gradient || "from-primary to-accent",
        bgColor: defaultCategories[idx % defaultCategories.length]?.bgColor || "bg-muted",
        iconColor: defaultCategories[idx % defaultCategories.length]?.iconColor || "text-primary"
      }))
    : defaultCategories;

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
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
          {displayCategories.map((category, index) => {
            const IconComponent = iconMap[category.icon] || ShoppingBag;
            return (
              <Card
                key={category.id}
                className={`group cursor-pointer overflow-hidden border-2 border-transparent hover:border-primary/30 shadow-lg hover:shadow-2xl transition-all duration-500 animate-fade-in hover-scale ${category.bgColor}`}
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => navigate(`/category/${category.id}`)}
              >
                <div className="relative aspect-square p-6 flex flex-col items-center justify-center text-center">
                  <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                  
                  <div className="relative z-10 space-y-4">
                    <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${category.gradient} p-0.5 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-lg`}>
                      <div className="w-full h-full bg-white rounded-2xl flex items-center justify-center">
                        <IconComponent className={`w-10 h-10 ${category.iconColor} group-hover:scale-110 transition-transform duration-300`} />
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                        {category.name}
                      </h3>
                      <p className="text-sm text-muted-foreground font-medium">
                        {category.count}
                      </p>
                    </div>
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

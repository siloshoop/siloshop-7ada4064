import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  Home, 
  Search, 
  Grid3X3, 
  Heart, 
  User,
  MessageCircle,
  Settings,
  ShoppingCart,
  Smartphone,
  Shirt,
  Baby,
  Footprints,
  Gamepad2,
  Sparkle,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";

interface Category {
  id: string;
  name_ar: string;
  icon: string | null;
}

const iconMap: Record<string, any> = {
  Smartphone, Shirt, Baby, Footprints, Gamepad2, Sparkle,
};

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name_ar, icon")
        .order("name_ar");
      if (data) setCategories(data);
    };
    fetchCategories();
  }, []);

  const navItems = [
    { icon: Home, label: "الرئيسية", path: "/" },
    { icon: Search, label: "بحث", path: "/search" },
    { icon: Grid3X3, label: "الفئات", action: () => setShowCategories(true) },
    { icon: Heart, label: "المفضلة", path: "/favorites" },
    { icon: Settings, label: "الإعدادات", path: "/notifications/settings" },
    { icon: User, label: "حسابي", path: "/dashboard" },
  ];

  const isActive = (path?: string) => path && location.pathname === path;

  return (
    <>
      {/* Bottom Navigation Bar - Only visible on mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-14 px-2">
          {navItems.map((item, index) => (
            <button
              key={index}
              onClick={() => item.path ? navigate(item.path) : item.action?.()}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 px-1 rounded-lg transition-all",
                isActive(item.path)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 transition-transform",
                isActive(item.path) && "scale-110"
              )} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Categories Sheet */}
      <Sheet open={showCategories} onOpenChange={setShowCategories}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-center">تصفح الفئات</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full pb-8">
            <div className="grid grid-cols-3 gap-3 px-2">
              {categories.map((category) => {
                const IconComponent = iconMap[category.icon || "Smartphone"] || Grid3X3;
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      navigate(`/category/${category.id}`);
                      setShowCategories(false);
                    }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/50 hover:bg-primary/10 transition-all active:scale-95"
                  >
                    <div className="p-3 rounded-full bg-primary/10">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-xs font-medium text-center line-clamp-2">
                      {category.name_ar}
                    </span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Spacer to prevent content from being hidden behind nav */}
      <div className="md:hidden h-14" />
    </>
  );
};

export default MobileBottomNav;
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Home, Menu, Heart, Settings, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      const { data } = await supabase.rpc("has_any_admin_role", { _user_id: auth.user.id });
      if (!cancelled) setIsAdmin(Boolean(data));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = [
    { icon: Home, label: "الرئيسية", path: "/" },
    { icon: Menu, label: "الفئات", action: () => window.dispatchEvent(new Event("siloshop:open-categories")) },
    { icon: Heart, label: "المفضلة", path: "/favorites" },
    isAdmin
      ? { icon: ShieldCheck, label: "الإدارة", path: "/admin/products" }
      : { icon: Settings, label: "الإعدادات", path: "/notifications/settings" },
  ];

  const isActive = (path?: string) => path && location.pathname === path;

  return (
    <>
      <nav
        data-testid="mobile-bottom-bar"
        className="mobile-fixed-bottom safe-area-x fixed inset-x-0 bottom-0 z-50 max-w-full border-t border-border bg-background/95 backdrop-blur-lg md:hidden"
      >
        <div className="mobile-fixed-bar-content flex min-w-0 items-center justify-around px-0.5 sm:px-1">
          {navItems.map((item, index) => (
            <Button
              variant="ghost"
              key={index}
              onClick={() => item.path ? navigate(item.path) : item.action?.()}
              className={cn(
                "flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 transition-all",
                isActive(item.path)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 transition-transform",
                isActive(item.path) && "scale-110"
              )} />
               <span className="max-w-full truncate text-[9px] font-medium min-[360px]:text-[10px]">{item.label}</span>
            </Button>
          ))}
        </div>
      </nav>

      <div className="mobile-nav-spacer md:hidden" aria-hidden="true" />
    </>
  );
};

export default MobileBottomNav;

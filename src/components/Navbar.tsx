import { ShoppingCart, Search, Menu, Heart, User, LogOut, LayoutDashboard, SlidersHorizontal, Gift, Scale, Home } from "lucide-react";
import { useFlyToCart } from "@/components/FlyToCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchAutocomplete from "@/components/search/SearchAutocomplete";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { ThemeToggle } from "@/components/ThemeToggle";
import PushNotificationManager from "@/components/PushNotificationManager";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useCompareProducts } from "@/hooks/useCompareProducts";
import MegaMenu from "@/components/MegaMenu";
import CategoryDrawerList from "@/components/CategoryDrawerList";
import BrandLogo from "@/components/BrandLogo";
import { notifySync, useSyncListener } from "@/lib/uiSync";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [cartBounce, setCartBounce] = useState(false);
  const { compareProducts, compareCount } = useCompareProducts();
  const { cartRef } = useFlyToCart();

  const fetchCartCount = useCallback(async () => {
    if (!user) {
      setCartCount(0);
      return;
    }

    const { data, error } = await supabase
      .from("cart_items")
      .select("quantity")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching cart count:", error);
      return;
    }

    const totalItems = (data || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
    setCartCount((prev) => {
      if (totalItems !== prev && totalItems > 0) {
        setCartBounce(true);
        setTimeout(() => setCartBounce(false), 500);
      }
      return totalItems;
    });
  }, [user]);

  useEffect(() => {
    fetchCartCount();
  }, [fetchCartCount]);

  useSyncListener(["cart"], fetchCartCount);
  return (
    <header data-testid="site-header" className="safe-area-top safe-area-x sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex min-w-0 flex-wrap items-center justify-between gap-x-1 gap-y-1 px-2 py-1 sm:px-4 md:h-16 md:flex-nowrap md:gap-4 md:py-0">
        {/* Right side - Icons */}
        <div className="order-2 flex min-w-0 items-center gap-0 md:order-none md:justify-start md:gap-2">
          <div className="hidden md:block"><ThemeToggle /></div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative h-9 w-9 md:h-10 md:w-10"
            aria-label="السلة"
            onClick={() => navigate("/cart")}
            ref={(el: HTMLButtonElement | null) => { (cartRef as React.MutableRefObject<HTMLElement | null>).current = el; }}
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <Badge className={`absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-xs bg-primary transition-transform ${cartBounce ? "animate-[cartPulse_0.5s_ease-out]" : ""}`}>
                {cartCount > 99 ? "99+" : cartCount}
              </Badge>
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="hidden h-9 w-9 md:inline-flex md:h-10 md:w-10"
            onClick={() => navigate("/favorites")}
          >
            <Heart className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="relative h-9 w-9 md:h-10 md:w-10"
            onClick={() => {
              if (compareCount > 0) {
                navigate(`/compare?products=${compareProducts.join(",")}`);
              } else {
                navigate("/compare");
              }
            }}
            title="مقارنة المنتجات"
          >
            <Scale className="h-5 w-5" />
            {compareCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-primary">
                {compareCount}
              </Badge>
            )}
          </Button>

          {user && (
            <>
              <div className="hidden md:block"><PushNotificationManager variant="icon" /></div>
              <NotificationsDropdown />
            </>
          )}

          {!loading && (
            user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="حسابي" className="h-9 w-9 md:h-10 md:w-10">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <LayoutDashboard className="ml-2 h-4 w-4" />
                    <span>لوحة التحكم</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="ml-2 h-4 w-4" />
                    <span>الملف الشخصي</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/orders")}>
                    <ShoppingCart className="ml-2 h-4 w-4" />
                    <span>طلباتي</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/account/addresses")}>
                    <Gift className="ml-2 h-4 w-4" />
                    <span>عناوين التوصيل</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-red-600">
                    <LogOut className="ml-2 h-4 w-4" />
                    <span>تسجيل الخروج</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={() => navigate("/auth", { state: { from: location.pathname + location.search } })} size="sm" aria-label="تسجيل الدخول" className="h-9 w-9 shrink-0 px-0 md:w-auto md:px-3">
                <User className="h-5 w-5 md:hidden" />
                <span className="hidden md:inline">تسجيل الدخول</span>
              </Button>
            )
          )}
        </div>

        {/* Center - Search */}
        <div className="order-3 flex w-full min-w-0 items-center gap-1 md:order-none md:max-w-2xl md:flex-1">
          <SearchAutocomplete className="flex-1" />
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => navigate("/search")}
            title="البحث المتقدم"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Left side - Logo & Menu */}
        <div className="order-1 flex min-w-0 items-center gap-1 md:order-none md:gap-4">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10" aria-label="الفئات">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(340px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-start text-lg">الفئات الأكثر شعبية</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <CategoryDrawerList onNavigate={() => setMobileMenuOpen(false)} />
              </div>
              <div className="mt-6 flex flex-col gap-1 border-t pt-4 md:hidden">
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  {user && <PushNotificationManager variant="icon" />}
                </div>
                <Button variant="ghost" className="justify-start" onClick={() => { navigate("/turkish-products"); setMobileMenuOpen(false); }}>
                  منتجات تركية
                </Button>
                <Button 
                  variant="ghost" 
                  className="justify-start" 
                  onClick={() => {
                    navigate("/");
                    setMobileMenuOpen(false);
                  }}
                >
                  الرئيسية
                </Button>
                <Button 
                  variant="ghost" 
                  className="justify-start" 
                  onClick={() => {
                    navigate("/about");
                    setMobileMenuOpen(false);
                  }}
                >
                  من نحن
                </Button>
                <Button 
                  variant="ghost" 
                  className="justify-start" 
                  onClick={() => {
                    navigate("/faq");
                    setMobileMenuOpen(false);
                  }}
                >
                  الأسئلة الشائعة
                </Button>
                <Button 
                  variant="ghost" 
                  className="justify-start" 
                  onClick={() => {
                    navigate("/contact");
                    setMobileMenuOpen(false);
                  }}
                >
                  اتصل بنا
                </Button>
                {user && (
                  <>
                    <Button 
                      variant="ghost" 
                      className="justify-start"
                      onClick={() => {
                        navigate("/orders");
                        setMobileMenuOpen(false);
                      }}
                    >
                      طلباتي
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="justify-start"
                      onClick={() => {
                        navigate("/dashboard");
                        setMobileMenuOpen(false);
                      }}
                    >
                      لوحة التحكم
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="justify-start"
                      onClick={() => {
                        navigate("/favorites");
                        setMobileMenuOpen(false);
                      }}
                    >
                      المفضلة
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="justify-start text-red-600"
                      onClick={() => {
                        signOut();
                        setMobileMenuOpen(false);
                      }}
                    >
                      تسجيل الخروج
                    </Button>
                  </>
                )}
                {!user && (
                  <Button 
                    onClick={() => {
                      navigate("/auth", { state: { from: location.pathname + location.search } });
                      setMobileMenuOpen(false);
                    }}
                  >
                    تسجيل الدخول
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
          <BrandLogo
            as="h1"
            onClick={() => navigate("/")}
            className="max-w-[100px] text-base sm:max-w-[160px] sm:text-2xl md:max-w-none md:text-3xl"
          />
        </div>
      </div>

      {/* Mega Menu Navigation */}
      <nav className="hidden border-t bg-background/95 md:block">
        <div className="container flex h-10 min-w-0 items-center justify-between overflow-hidden px-3 sm:px-4">
          <div className="hidden shrink-0 md:block">
            <MegaMenu />
          </div>
          
          <div className="flex min-w-0 flex-1 items-center justify-start gap-4 overflow-x-auto scrollbar-hide [&>*]:shrink-0 md:justify-end">
            <NavLink 
              to="/" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              activeClassName="text-foreground font-semibold"
            >
              الرئيسية
            </NavLink>
            <NavLink
              to="/turkish-products"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              activeClassName="text-foreground font-semibold"
            >
              منتجات تركية
            </NavLink>
            <NavLink 
              to="/about" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap hidden sm:block"
              activeClassName="text-foreground font-semibold"
            >
              من نحن
            </NavLink>
            <NavLink 
              to="/contact" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap hidden sm:block"
              activeClassName="text-foreground font-semibold"
            >
              اتصل بنا
            </NavLink>
            {user && (
              <NavLink 
                to="/orders" 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                activeClassName="text-foreground font-semibold"
              >
                طلباتي
              </NavLink>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
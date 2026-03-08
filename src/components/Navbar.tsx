import { ShoppingCart, Search, Menu, Heart, User, LogOut, LayoutDashboard, SlidersHorizontal, Gift, Scale } from "lucide-react";
import { useFlyToCart } from "@/components/FlyToCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { ThemeToggle } from "@/components/ThemeToggle";
import PushNotificationManager from "@/components/PushNotificationManager";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
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

const Navbar = () => {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { compareProducts, compareCount } = useCompareProducts();
  const { cartRef } = useFlyToCart();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4 px-4">
        {/* Right side - Icons */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            onClick={() => navigate("/cart")}
            ref={(el: HTMLButtonElement | null) => { (cartRef as React.MutableRefObject<HTMLElement | null>).current = el; }}
          >
            <ShoppingCart className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/favorites")}
          >
            <Heart className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="relative"
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
              <PushNotificationManager variant="icon" />
              <NotificationsDropdown />
            </>
          )}

          {!loading && (
            user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
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
                  <DropdownMenuItem onClick={() => navigate("/wishlist")}>
                    <Gift className="ml-2 h-4 w-4" />
                    <span>قوائم الأمنيات</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/orders")}>
                    <ShoppingCart className="ml-2 h-4 w-4" />
                    <span>طلباتي</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-red-600">
                    <LogOut className="ml-2 h-4 w-4" />
                    <span>تسجيل الخروج</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={() => navigate("/auth")} size="sm">
                تسجيل الدخول
              </Button>
            )
          )}
        </div>

        {/* Center - Search */}
        <div className="flex-1 max-w-2xl flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="ابحث عن المنتجات..."
              className="pr-10 w-full"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.target as HTMLInputElement).value;
                  if (value) navigate(`/search?q=${encodeURIComponent(value)}`);
                }
              }}
            />
          </div>
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
        <div className="flex items-center gap-4">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <SheetHeader>
                <SheetTitle>القائمة</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-6">
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
                      navigate("/auth");
                      setMobileMenuOpen(false);
                    }}
                  >
                    تسجيل الدخول
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
          <h1 
            className="text-2xl font-bold bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent cursor-pointer"
            onClick={() => navigate("/")}
          >
            متجر
          </h1>
        </div>
      </div>

      {/* Mega Menu Navigation */}
      <nav className="border-t bg-background/95">
        <div className="container px-4 flex items-center justify-between h-10">
          <div className="hidden md:block">
            <MegaMenu />
          </div>
          
          <div className="flex items-center gap-3 md:gap-4">
            <NavLink 
              to="/" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              activeClassName="text-foreground font-semibold"
            >
              الرئيسية
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
import { ShoppingCart, Search, Menu, Heart, User, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
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

const Navbar = () => {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4 px-4">
        {/* Right side - Icons */}
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            onClick={() => navigate("/cart")}
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

          {user && <NotificationsDropdown />}

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
                  if (value) navigate(`/?search=${encodeURIComponent(value)}`);
                }
              }}
            />
          </div>
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

      {/* Navigation Links */}
      <nav className="border-t">
        <div className="container flex items-center gap-6 px-4 h-12 overflow-x-auto">
          <Button variant="ghost" className="text-sm font-medium" onClick={() => navigate("/")}>
            الرئيسية
          </Button>
          {user && (
            <Button variant="ghost" className="text-sm font-medium" onClick={() => navigate("/orders")}>
              طلباتي
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
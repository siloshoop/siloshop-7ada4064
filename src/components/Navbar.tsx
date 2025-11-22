import { ShoppingCart, Search, Menu, Heart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4 px-4">
        {/* Right side - Icons */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative">
            <ShoppingCart className="h-5 w-5" />
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground">
              0
            </Badge>
          </Button>
          <Button variant="ghost" size="icon">
            <Heart className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <User className="h-5 w-5" />
          </Button>
        </div>

        {/* Center - Search */}
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="ابحث عن المنتجات..."
              className="pr-10 w-full"
            />
          </div>
        </div>

        {/* Left side - Logo & Menu */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent">
            متجر
          </h1>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="border-t">
        <div className="container flex items-center gap-6 px-4 h-12 overflow-x-auto">
          <Button variant="ghost" className="text-sm font-medium">
            الرئيسية
          </Button>
          <Button variant="ghost" className="text-sm font-medium">
            نساء
          </Button>
          <Button variant="ghost" className="text-sm font-medium">
            رجال
          </Button>
          <Button variant="ghost" className="text-sm font-medium">
            أطفال
          </Button>
          <Button variant="ghost" className="text-sm font-medium">
            إلكترونيات
          </Button>
          <Button variant="ghost" className="text-sm font-medium">
            منزل ومعيشة
          </Button>
          <Button variant="ghost" className="text-sm font-medium text-sale">
            تخفيضات
          </Button>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;

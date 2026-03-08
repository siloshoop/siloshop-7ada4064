import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { SlidersHorizontal, Star, Gem } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Category {
  id: string;
  name_ar: string;
}

interface Brand {
  id: string;
  name_ar: string;
}

interface SearchFiltersProps {
  onFilterChange: (filters: {
    minPrice: number;
    maxPrice: number;
    categoryId: string;
    sortBy: string;
    minVendorRating: number;
    brandId: string;
  }) => void;
}

export const SearchFilters = ({ onFilterChange }: SearchFiltersProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000000);
  const [priceRange, setPriceRange] = useState([0, 1000000]);
  const [categoryId, setCategoryId] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [minVendorRating, setMinVendorRating] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("id, name_ar")
      .order("name_ar");

    if (data) {
      setCategories(data);
    }
  };

  const applyFilters = () => {
    onFilterChange({
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
      categoryId,
      sortBy,
      minVendorRating,
    });
    setOpen(false);
  };

  const resetFilters = () => {
    setPriceRange([0, 1000000]);
    setCategoryId("");
    setSortBy("newest");
    setMinVendorRating(0);
    onFilterChange({
      minPrice: 0,
      maxPrice: 1000000,
      categoryId: "",
      sortBy: "newest",
      minVendorRating: 0,
    });
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>تصفية النتائج</SheetTitle>
          <SheetDescription>
            اختر الخيارات المناسبة لتصفية المنتجات
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* نطاق السعر */}
          <div className="space-y-4">
            <Label>نطاق السعر (ل.س)</Label>
            <div className="px-2">
              <Slider
                value={priceRange}
                onValueChange={setPriceRange}
                max={1000000}
                step={10000}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-xs">من</Label>
                <Input
                  type="number"
                  value={priceRange[0]}
                  onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">إلى</Label>
                <Input
                  type="number"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 1000000])}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* الفئة */}
          <div className="space-y-2">
            <Label>الفئة</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الفئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">جميع الفئات</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* الترتيب */}
          <div className="space-y-2">
            <Label>ترتيب حسب</Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">الأحدث</SelectItem>
                <SelectItem value="price_asc">السعر: من الأقل للأعلى</SelectItem>
                <SelectItem value="price_desc">السعر: من الأعلى للأقل</SelectItem>
                <SelectItem value="name_asc">الاسم: أ - ي</SelectItem>
                <SelectItem value="name_desc">الاسم: ي - أ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* تقييم البائع */}
          <div className="space-y-2">
            <Label>الحد الأدنى لتقييم البائع</Label>
            <Select value={String(minVendorRating)} onValueChange={(v) => setMinVendorRating(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">الكل</SelectItem>
                <SelectItem value="3">
                  <span className="flex items-center gap-1">3+ <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /></span>
                </SelectItem>
                <SelectItem value="4">
                  <span className="flex items-center gap-1">4+ <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /></span>
                </SelectItem>
                <SelectItem value="5">
                  <span className="flex items-center gap-1">5 <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /></span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* الأزرار */}
          <div className="flex gap-2 pt-4">
            <Button onClick={applyFilters} className="flex-1">
              تطبيق الفلاتر
            </Button>
            <Button onClick={resetFilters} variant="outline" className="flex-1">
              إعادة تعيين
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

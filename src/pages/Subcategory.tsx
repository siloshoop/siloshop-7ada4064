import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Loader2, Filter, Search, Star, ArrowRight, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { matchesSearchTerm } from "@/lib/search";

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  vendor_id: string;
  stock_quantity?: number | null;
  reviews: { rating: number }[];
}

interface VendorRating {
  vendor_id: string;
  avg_rating: number;
}

const Subcategory = () => {
  const { categoryId, subcategoryId } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [vendorRatings, setVendorRatings] = useState<Map<string, number>>(new Map());
  const [categoryName, setCategoryName] = useState("");
  const [subcategoryName, setSubcategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCategoryFallbackNotice, setShowCategoryFallbackNotice] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState([0, 1000000]);
  const [maxPrice, setMaxPrice] = useState(1000000);
  const [sortBy, setSortBy] = useState("newest");
  const [minVendorRating, setMinVendorRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [hasDiscountOnly, setHasDiscountOnly] = useState(false);

  useEffect(() => {
    if (categoryId && subcategoryId) {
      fetchData();
    }
  }, [categoryId, subcategoryId]);

  useEffect(() => {
    applyFilters();
  }, [products, searchQuery, priceRange, sortBy, minVendorRating, inStockOnly, hasDiscountOnly, vendorRatings]);

  const fetchData = async () => {
    setLoading(true);
    setShowCategoryFallbackNotice(false);
    
    // Fetch category info
    const { data: categoryData } = await supabase
      .from("categories")
      .select("name_ar")
      .eq("id", categoryId)
      .maybeSingle();

    if (categoryData) {
      setCategoryName(categoryData.name_ar);
    }

    // Try to fetch subcategory from DB
    const { data: subcategoryData } = await supabase
      .from("subcategories")
      .select("name_ar")
      .eq("id", subcategoryId)
      .maybeSingle();

    if (subcategoryData) {
      setSubcategoryName(subcategoryData.name_ar);
    } else {
      // Use default subcategory name mapping
      const defaultNames: Record<string, string> = {
        "sneakers": "أحذية رياضية",
        "formal-shoes": "أحذية رسمية",
        "sandals": "صنادل",
        "boots": "بوط",
        "slippers": "شباشب",
        "heels": "كعب عالي",
        "dresses": "فساتين",
        "abayas": "عباءات",
        "blouses": "بلوزات",
        "pants-women": "بناطيل",
        "skirts": "تنانير",
        "pajamas-women": "بيجامات",
        "underwear-women": "ملابس داخلية",
        "sportswear-women": "ملابس رياضية",
        "coats-women": "معاطف وجاكيتات",
        "hijab": "حجابات وطرح",
        "shirts": "قمصان",
        "t-shirts": "تيشيرتات",
        "pants-men": "بناطيل",
        "suits": "بدلات رسمية",
        "jeans": "جينز",
        "pajamas-men": "بيجامات",
        "underwear-men": "ملابس داخلية",
        "sportswear-men": "ملابس رياضية",
        "coats-men": "معاطف وجاكيتات",
        "thobe": "جلابيات وثياب",
        "baby-clothes": "ملابس رضع",
        "boys-clothes": "ملابس أولاد",
        "girls-clothes": "ملابس بنات",
        "kids-shoes": "أحذية أطفال",
        "kids-pajamas": "بيجامات أطفال",
        "school-uniforms": "زي مدرسي",
        "kids-sportswear": "ملابس رياضية",
        "watches": "ساعات",
        "jewelry": "مجوهرات",
        "sunglasses": "نظارات شمسية",
        "belts": "أحزمة",
        "scarves": "أوشحة",
        "hats": "قبعات",
        "wallets": "محافظ",
        "handbags": "حقائب يد",
        "backpacks": "حقائب ظهر",
        "travel-bags": "حقائب سفر",
        "laptop-bags": "حقائب لابتوب",
        "clutches": "كلاتش",
        "school-bags": "حقائب مدرسية",
        "living-room": "غرفة معيشة",
        "bedroom": "غرفة نوم",
        "dining-room": "غرفة طعام",
        "office-furniture": "أثاث مكتبي",
        "kids-furniture": "أثاث أطفال",
        "outdoor-furniture": "أثاث خارجي",
        "video-games": "ألعاب فيديو",
        "board-games": "ألعاب طاولة",
        "toys-kids": "ألعاب أطفال",
        "educational-toys": "ألعاب تعليمية",
        "outdoor-toys": "ألعاب خارجية",
        "dolls": "دمى وعرائس",
        "makeup": "مكياج",
        "skincare": "عناية بالبشرة",
        "haircare": "عناية بالشعر",
        "perfumes": "عطور",
        "nail-care": "عناية بالأظافر",
        "body-care": "عناية بالجسم",
        "novels": "روايات",
        "religious": "كتب دينية",
        "educational": "كتب تعليمية",
        "children-books": "كتب أطفال",
        "self-development": "تطوير ذات",
        "cooking-books": "كتب طبخ",
        "gym-equipment": "معدات رياضية",
        "sports-clothes": "ملابس رياضية",
        "sports-shoes": "أحذية رياضية",
        "football": "كرة قدم",
        "swimming": "سباحة",
        "cycling": "دراجات",
      };
      setSubcategoryName(defaultNames[subcategoryId!] || subcategoryId!);
    }

    // Fetch products - try with subcategory_id first, fall back to category
    let productsQuery = supabase
      .from("products")
      .select(`
        id,
        name,
        price,
        original_price,
        image_url,
        vendor_id,
        stock_quantity,
        reviews(rating)
      `)
      .eq("is_active", true);

    // Check if subcategoryId is a UUID (from DB) or a string key (default)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subcategoryId!);
    
    if (isUUID) {
      productsQuery = productsQuery.eq("subcategory_id", subcategoryId);
    } else {
      // For default subcategories, filter by category
      productsQuery = productsQuery.eq("category_id", categoryId);
    }

    const { data: productsData } = await productsQuery.order("created_at", { ascending: false });

    let resolvedProducts = (productsData || []) as Product[];

    if (resolvedProducts.length === 0 && isUUID && categoryId) {
      const { data: fallbackProducts } = await supabase
        .from("products")
        .select(`
          id,
          name,
          price,
          original_price,
          image_url,
          vendor_id,
          stock_quantity,
          reviews(rating)
        `)
        .eq("category_id", categoryId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (fallbackProducts?.length) {
        resolvedProducts = fallbackProducts as Product[];
        setShowCategoryFallbackNotice(true);
      }
    }

    if (resolvedProducts.length > 0) {
      setProducts(resolvedProducts as any);
      
      // Calculate max price
      const prices = resolvedProducts.map(p => p.price);
      if (prices.length > 0) {
        const max = Math.max(...prices);
        setMaxPrice(max);
        setPriceRange([0, max]);
      }
      
      // Fetch vendor ratings
      const vendorIds = [...new Set(resolvedProducts.map(p => p.vendor_id))];
      if (vendorIds.length > 0) {
        const { data: ratingsData } = await supabase
          .from("vendor_ratings")
          .select("vendor_id, rating")
          .in("vendor_id", vendorIds);
        
        if (ratingsData) {
          const ratingsMap = new Map<string, number[]>();
          ratingsData.forEach(r => {
            if (!ratingsMap.has(r.vendor_id)) {
              ratingsMap.set(r.vendor_id, []);
            }
            ratingsMap.get(r.vendor_id)!.push(r.rating);
          });
          
          const avgRatings = new Map<string, number>();
          ratingsMap.forEach((ratings, vendorId) => {
            avgRatings.set(vendorId, ratings.reduce((a, b) => a + b, 0) / ratings.length);
          });
          setVendorRatings(avgRatings);
        }
      }
    } else {
      setProducts([]);
      setFilteredProducts([]);
      setVendorRatings(new Map());
    }
    setLoading(false);
  };

  const applyFilters = () => {
    let result = [...products];

    // Search filter
    if (searchQuery) {
      result = result.filter(p => 
        matchesSearchTerm(p.name, searchQuery)
      );
    }

    // Price filter
    result = result.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);

    // Vendor rating filter
    if (minVendorRating > 0) {
      result = result.filter(p => {
        const vendorRating = vendorRatings.get(p.vendor_id) || 0;
        return vendorRating >= minVendorRating;
      });
    }

    // In stock filter
    if (inStockOnly) {
      result = result.filter(p => (p as any).stock_quantity > 0);
    }

    // Discount filter
    if (hasDiscountOnly) {
      result = result.filter(p => p.original_price && p.original_price > p.price);
    }

    // Sort
    switch (sortBy) {
      case "price_asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "name_asc":
        result.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        break;
      case "name_desc":
        result.sort((a, b) => b.name.localeCompare(a.name, 'ar'));
        break;
      case "rating":
        result.sort((a, b) => {
          const ratingA = a.reviews?.length > 0 
            ? a.reviews.reduce((sum, r) => sum + r.rating, 0) / a.reviews.length 
            : 0;
          const ratingB = b.reviews?.length > 0 
            ? b.reviews.reduce((sum, r) => sum + r.rating, 0) / b.reviews.length 
            : 0;
          return ratingB - ratingA;
        });
        break;
    }

    setFilteredProducts(result);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setPriceRange([0, maxPrice]);
    setSortBy("newest");
    setMinVendorRating(0);
    setInStockOnly(false);
    setHasDiscountOnly(false);
  };

  const activeFiltersCount = [
    searchQuery,
    priceRange[0] > 0 || priceRange[1] < maxPrice,
    sortBy !== "newest",
    minVendorRating > 0,
    inStockOnly,
    hasDiscountOnly
  ].filter(Boolean).length;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => navigate("/")} className="hover:text-primary">
            الرئيسية
          </button>
          <ArrowRight className="w-4 h-4" />
          <button onClick={() => navigate(`/category/${categoryId}`)} className="hover:text-primary">
            {categoryName}
          </button>
          <ArrowRight className="w-4 h-4" />
          <span className="text-foreground font-medium">{subcategoryName}</span>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{subcategoryName}</h1>
            <p className="text-muted-foreground">{filteredProducts.length} منتج</p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto">
            {/* Search */}
            <div className="relative w-full sm:flex-1 md:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ابحث في المنتجات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>

            {/* Mobile Filters */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative w-full sm:w-auto">
                  <SlidersHorizontal className="w-4 h-4 ml-2" />
                  الفلاتر
                  {activeFiltersCount > 0 && (
                    <Badge className="absolute -top-2 -left-2 h-5 w-5 p-0 flex items-center justify-center">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:w-80">
                <SheetHeader>
                  <SheetTitle className="flex items-center justify-between">
                    <span>فلترة المنتجات</span>
                    {activeFiltersCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="w-4 h-4 ml-1" />
                        مسح الكل
                      </Button>
                    )}
                  </SheetTitle>
                </SheetHeader>
                
                <div className="space-y-6 mt-6">
                  {/* Sort */}
                  <div className="space-y-2">
                    <Label>الترتيب</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">الأحدث</SelectItem>
                        <SelectItem value="price_asc">السعر: من الأقل للأعلى</SelectItem>
                        <SelectItem value="price_desc">السعر: من الأعلى للأقل</SelectItem>
                        <SelectItem value="name_asc">الاسم: أ-ي</SelectItem>
                        <SelectItem value="name_desc">الاسم: ي-أ</SelectItem>
                        <SelectItem value="rating">التقييم الأعلى</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price Range */}
                  <div className="space-y-4">
                    <Label>نطاق السعر</Label>
                    <Slider
                      value={priceRange}
                      onValueChange={setPriceRange}
                      max={maxPrice}
                      step={100}
                      className="w-full"
                    />
                    <div className="flex items-center justify-between text-sm">
                      <span>{priceRange[0].toLocaleString()} ل.س</span>
                      <span>{priceRange[1].toLocaleString()} ل.س</span>
                    </div>
                  </div>

                  {/* Vendor Rating */}
                  <div className="space-y-2">
                    <Label>تقييم البائع</Label>
                    <Select value={minVendorRating.toString()} onValueChange={(v) => setMinVendorRating(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">الكل</SelectItem>
                        <SelectItem value="3">3+ نجوم</SelectItem>
                        <SelectItem value="4">4+ نجوم</SelectItem>
                        <SelectItem value="4.5">4.5+ نجوم</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quick Filters */}
                  <div className="space-y-3">
                    <Label>فلاتر سريعة</Label>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={inStockOnly ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setInStockOnly(!inStockOnly)}
                      >
                        متوفر فقط
                      </Badge>
                      <Badge
                        variant={hasDiscountOnly ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setHasDiscountOnly(!hasDiscountOnly)}
                      >
                        عروض وخصومات
                      </Badge>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop Sort */}
            <div className="hidden md:block">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="الترتيب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">الأحدث</SelectItem>
                  <SelectItem value="price_asc">السعر: من الأقل للأعلى</SelectItem>
                  <SelectItem value="price_desc">السعر: من الأعلى للأقل</SelectItem>
                  <SelectItem value="rating">التقييم الأعلى</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Active Filters */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-sm text-muted-foreground">الفلاتر النشطة:</span>
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                البحث: {searchQuery}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery("")} />
              </Badge>
            )}
            {(priceRange[0] > 0 || priceRange[1] < maxPrice) && (
              <Badge variant="secondary" className="gap-1">
                السعر: {priceRange[0].toLocaleString()} - {priceRange[1].toLocaleString()} ل.س
                <X className="w-3 h-3 cursor-pointer" onClick={() => setPriceRange([0, maxPrice])} />
              </Badge>
            )}
            {minVendorRating > 0 && (
              <Badge variant="secondary" className="gap-1">
                تقييم البائع: {minVendorRating}+ نجوم
                <X className="w-3 h-3 cursor-pointer" onClick={() => setMinVendorRating(0)} />
              </Badge>
            )}
            {inStockOnly && (
              <Badge variant="secondary" className="gap-1">
                متوفر فقط
                <X className="w-3 h-3 cursor-pointer" onClick={() => setInStockOnly(false)} />
              </Badge>
            )}
            {hasDiscountOnly && (
              <Badge variant="secondary" className="gap-1">
                عروض وخصومات
                <X className="w-3 h-3 cursor-pointer" onClick={() => setHasDiscountOnly(false)} />
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              مسح الكل
            </Button>
          </div>
        )}

        {showCategoryFallbackNotice && filteredProducts.length > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            لا توجد منتجات مرتبطة بهذه الفئة الفرعية حالياً، لذلك نعرض لك منتجات الفئة الرئيسية مؤقتاً.
          </div>
        )}

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Search className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">لا توجد منتجات</h3>
            <p className="text-muted-foreground mb-4">جرب تغيير الفلاتر أو البحث بكلمات مختلفة</p>
            <Button onClick={clearFilters}>مسح الفلاتر</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const avgRating = product.reviews?.length > 0
                ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
                : 4;
              
              const discount = product.original_price
                ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
                : undefined;

              return (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  originalPrice={product.original_price || undefined}
                  image={product.image_url}
                  rating={avgRating}
                  reviews={product.reviews?.length || 0}
                  discount={discount}
                />
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Subcategory;

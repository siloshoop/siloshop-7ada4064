import { useState, useEffect, useCallback, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  Loader2, Search as SearchIcon, SlidersHorizontal, Star, X, Tag, 
  DollarSign, User, Layers, ArrowUpDown, RotateCcw, Gem 
} from "lucide-react";
import AdPlaceholder from "@/components/AdPlaceholder";
import NativeAdCard from "@/components/NativeAdCard";
import { useNativeAds } from "@/hooks/useNativeAds";
import { matchesSearchTerm } from "@/lib/search";

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  vendor_id: string;
  category_id: string | null;
  subcategory_id: string | null;
  stock_quantity: number | null;
  shipping_cost?: number;
  reviews: { rating: number }[];
}

interface Category {
  id: string;
  name_ar: string;
}

interface Subcategory {
  id: string;
  name_ar: string;
  category_id: string;
}

interface Vendor {
  id: string;
  full_name: string;
}

interface Brand {
  id: string;
  name_ar: string;
}

interface Filters {
  search: string;
  minPrice: number;
  maxPrice: number;
  categoryIds: string[];
  subcategoryIds: string[];
  vendorIds: string[];
  brandIds: string[];
  minRating: number;
  sortBy: string;
  hasDiscount: boolean;
  inStock: boolean;
  freeShipping: boolean;
}

const defaultFilters: Filters = {
  search: "",
  minPrice: 0,
  maxPrice: 10000000,
  categoryIds: [],
  subcategoryIds: [],
  vendorIds: [],
  brandIds: [],
  minRating: 0,
  sortBy: "newest",
  hasDiscount: false,
  inStock: false,
  freeShipping: false,
};

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { data: nativeAds = [] } = useNativeAds("search");
  const urlSearchQuery = searchParams.get("q")?.trim() || "";

  const [filters, setFilters] = useState<Filters>(() => ({
    ...defaultFilters,
    search: urlSearchQuery,
  }));

  const [priceRange, setPriceRange] = useState([0, 10000000]);

  // Fetch categories, subcategories, and vendors on mount
  useEffect(() => {
    const fetchFilterData = async () => {
      const [categoriesRes, subcategoriesRes, vendorsRes, brandsRes] = await Promise.all([
        supabase.from("categories").select("id, name_ar").order("name_ar"),
        supabase.from("subcategories").select("id, name_ar, category_id").eq("is_active", true).order("name_ar"),
        supabase.from("profiles").select("id, full_name").eq("role", "vendor"),
        supabase.from("brands").select("id, name_ar").eq("is_active", true).order("name_ar"),
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (subcategoriesRes.data) setSubcategories(subcategoriesRes.data);
      if (vendorsRes.data) setVendors(vendorsRes.data as Vendor[]);
      if (brandsRes.data) setBrands(brandsRes.data);
    };

    fetchFilterData();
  }, []);

  useEffect(() => {
    setFilters((prev) => (
      prev.search === urlSearchQuery
        ? prev
        : {
            ...prev,
            search: urlSearchQuery,
          }
    ));
  }, [urlSearchQuery]);

  // Search products when filters change
  useEffect(() => {
    searchProducts();
  }, [filters]);

  const searchProducts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("products")
        .select("id, name, price, original_price, image_url, vendor_id, category_id, subcategory_id, stock_quantity, shipping_cost, reviews(rating)", { count: "exact" })
        .eq("is_active", true);

      // Price range
      query = query.gte("price", filters.minPrice).lte("price", filters.maxPrice);

      // Categories
      if (filters.categoryIds.length > 0) {
        query = query.in("category_id", filters.categoryIds);
      }

      // Subcategories
      if (filters.subcategoryIds.length > 0) {
        query = query.in("subcategory_id", filters.subcategoryIds);
      }

      // Vendors
      if (filters.vendorIds.length > 0) {
        query = query.in("vendor_id", filters.vendorIds);
      }

      // Brands
      if (filters.brandIds.length > 0) {
        query = query.in("brand_id", filters.brandIds);
      }

      // Has discount
      if (filters.hasDiscount) {
        query = query.not("original_price", "is", null);
      }

      // In stock
      if (filters.inStock) {
        query = query.gt("stock_quantity", 0);
      }

      // Free shipping
      if (filters.freeShipping) {
        query = query.eq("shipping_cost", 0);
      }

      // Sorting
      switch (filters.sortBy) {
        case "price_asc":
          query = query.order("price", { ascending: true });
          break;
        case "price_desc":
          query = query.order("price", { ascending: false });
          break;
        case "name_asc":
          query = query.order("name", { ascending: true });
          break;
        case "name_desc":
          query = query.order("name", { ascending: false });
          break;
        default:
          query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredProducts = (data || []) as Product[];

      if (filters.search.trim()) {
        filteredProducts = filteredProducts.filter((product) =>
          matchesSearchTerm(product.name, filters.search)
        );
      }

      // Filter by rating client-side (since it's calculated from reviews)
      if (filters.minRating > 0) {
        filteredProducts = filteredProducts.filter((product: any) => {
          const avgRating = product.reviews?.length > 0
            ? product.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / product.reviews.length
            : 0;
          return avgRating >= filters.minRating;
        });
      }

      setProducts(filteredProducts);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleArrayFilter = (key: "categoryIds" | "subcategoryIds" | "vendorIds" | "brandIds", id: string) => {
    setFilters((prev) => {
      const array = prev[key];
      const newArray = array.includes(id)
        ? array.filter((item) => item !== id)
        : [...array, id];
      return { ...prev, [key]: newArray };
    });
  };

  const applyPriceRange = () => {
    setFilters((prev) => ({
      ...prev,
      minPrice: priceRange[0],
      maxPrice: priceRange[1],
    }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setPriceRange([0, 10000000]);
  };

  const activeFiltersCount = 
    filters.categoryIds.length +
    filters.subcategoryIds.length +
    filters.vendorIds.length +
    filters.brandIds.length +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.hasDiscount ? 1 : 0) +
    (filters.inStock ? 1 : 0) +
    (filters.minPrice > 0 || filters.maxPrice < 10000000 ? 1 : 0) +
    (filters.freeShipping ? 1 : 0);

  const getAverageRating = (reviews: { rating: number }[]) => {
    if (!reviews || reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  };

  const filteredSubcategories = filters.categoryIds.length > 0
    ? subcategories.filter((sub) => filters.categoryIds.includes(sub.category_id))
    : subcategories;

  const FiltersContent = () => (
    <div className="space-y-6">
      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">الفلاتر النشطة ({activeFiltersCount})</Label>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 px-2">
              <RotateCcw className="h-4 w-4 ml-1" />
              إعادة تعيين
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.categoryIds.map((id) => {
              const cat = categories.find((c) => c.id === id);
              return cat ? (
                <Badge key={id} variant="secondary" className="gap-1">
                  {cat.name_ar}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => toggleArrayFilter("categoryIds", id)} />
                </Badge>
              ) : null;
            })}
            {filters.vendorIds.map((id) => {
              const vendor = vendors.find((v) => v.id === id);
              return vendor ? (
                <Badge key={id} variant="secondary" className="gap-1">
                  {vendor.full_name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => toggleArrayFilter("vendorIds", id)} />
                </Badge>
              ) : null;
            })}
            {filters.brandIds.map((id) => {
              const brand = brands.find((b) => b.id === id);
              return brand ? (
                <Badge key={id} variant="secondary" className="gap-1">
                  {brand.name_ar}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => toggleArrayFilter("brandIds", id)} />
                </Badge>
              ) : null;
            })}
            {filters.minRating > 0 && (
              <Badge variant="secondary" className="gap-1">
                {filters.minRating}+ نجوم
                <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter("minRating", 0)} />
              </Badge>
            )}
            {filters.hasDiscount && (
              <Badge variant="secondary" className="gap-1">
                عروض فقط
                <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter("hasDiscount", false)} />
              </Badge>
            )}
            {filters.inStock && (
              <Badge variant="secondary" className="gap-1">
                متوفر فقط
                <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter("inStock", false)} />
              </Badge>
            )}
            {filters.freeShipping && (
              <Badge variant="secondary" className="gap-1">
                شحن مجاني
                <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter("freeShipping", false)} />
              </Badge>
            )}
          </div>
        </div>
      )}

      <Accordion type="multiple" defaultValue={["price", "category", "rating"]} className="w-full">
        {/* Price Range */}
        <AccordionItem value="price">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              نطاق السعر
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <Slider
              value={priceRange}
              onValueChange={setPriceRange}
              max={10000000}
              step={50000}
              className="w-full"
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={priceRange[0]}
                onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])}
                className="flex-1"
                placeholder="من"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="number"
                value={priceRange[1]}
                onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 10000000])}
                className="flex-1"
                placeholder="إلى"
              />
            </div>
            <Button size="sm" onClick={applyPriceRange} className="w-full">
              تطبيق
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Categories */}
        <AccordionItem value="category">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              الفئات
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2 max-h-48 overflow-y-auto">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center gap-2">
                <Checkbox
                  id={`cat-${category.id}`}
                  checked={filters.categoryIds.includes(category.id)}
                  onCheckedChange={() => toggleArrayFilter("categoryIds", category.id)}
                />
                <label htmlFor={`cat-${category.id}`} className="text-sm cursor-pointer flex-1">
                  {category.name_ar}
                </label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* Subcategories */}
        {filteredSubcategories.length > 0 && (
          <AccordionItem value="subcategory">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                الفئات الفرعية
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pt-2 max-h-48 overflow-y-auto">
              {filteredSubcategories.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`sub-${sub.id}`}
                    checked={filters.subcategoryIds.includes(sub.id)}
                    onCheckedChange={() => toggleArrayFilter("subcategoryIds", sub.id)}
                  />
                  <label htmlFor={`sub-${sub.id}`} className="text-sm cursor-pointer flex-1">
                    {sub.name_ar}
                  </label>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Brands */}
        {brands.length > 0 && (
          <AccordionItem value="brand">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Gem className="h-4 w-4" />
                العلامات التجارية
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pt-2 max-h-48 overflow-y-auto">
              {brands.map((brand) => (
                <div key={brand.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`brand-${brand.id}`}
                    checked={filters.brandIds.includes(brand.id)}
                    onCheckedChange={() => toggleArrayFilter("brandIds", brand.id)}
                  />
                  <label htmlFor={`brand-${brand.id}`} className="text-sm cursor-pointer flex-1">
                    {brand.name_ar}
                  </label>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Vendors */}
        <AccordionItem value="vendor">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              البائعين
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2 max-h-48 overflow-y-auto">
            {vendors.map((vendor) => (
              <div key={vendor.id} className="flex items-center gap-2">
                <Checkbox
                  id={`vendor-${vendor.id}`}
                  checked={filters.vendorIds.includes(vendor.id)}
                  onCheckedChange={() => toggleArrayFilter("vendorIds", vendor.id)}
                />
                <label htmlFor={`vendor-${vendor.id}`} className="text-sm cursor-pointer flex-1">
                  {vendor.full_name}
                </label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* Rating */}
        <AccordionItem value="rating">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              التقييم
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            {[4, 3, 2, 1].map((rating) => (
              <div key={rating} className="flex items-center gap-2">
                <Checkbox
                  id={`rating-${rating}`}
                  checked={filters.minRating === rating}
                  onCheckedChange={(checked) => updateFilter("minRating", checked ? rating : 0)}
                />
                <label htmlFor={`rating-${rating}`} className="flex items-center gap-1 cursor-pointer">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                    />
                  ))}
                  <span className="text-sm text-muted-foreground mr-1">وأعلى</span>
                </label>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* Other Filters */}
        <AccordionItem value="other">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              خيارات أخرى
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="hasDiscount"
                checked={filters.hasDiscount}
                onCheckedChange={(checked) => updateFilter("hasDiscount", !!checked)}
              />
              <label htmlFor="hasDiscount" className="text-sm cursor-pointer">
                عروض وخصومات فقط
              </label>
            </div>
             <div className="flex items-center gap-2">
              <Checkbox
                id="inStock"
                checked={filters.inStock}
                onCheckedChange={(checked) => updateFilter("inStock", !!checked)}
              />
              <label htmlFor="inStock" className="text-sm cursor-pointer">
                المنتجات المتوفرة فقط
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="freeShipping"
                checked={filters.freeShipping}
                onCheckedChange={(checked) => updateFilter("freeShipping", !!checked)}
              />
              <label htmlFor="freeShipping" className="text-sm cursor-pointer">
                🚚 شحن مجاني فقط
              </label>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        {/* Search Header */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <form className="relative w-full flex-1" onSubmit={(e) => {
              e.preventDefault();
              (e.currentTarget.querySelector('input') as HTMLInputElement)?.blur();
            }}>
              <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="ابحث عن المنتجات..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="pr-10 text-lg h-12"
                enterKeyHint="search"
              />
            </form>
            
            {/* Mobile Filters Button */}
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="lg" className="relative w-full sm:w-auto lg:hidden">
                  <SlidersHorizontal className="h-5 w-5" />
                  {activeFiltersCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>تصفية النتائج</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FiltersContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Results Info & Sort */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              {loading ? "جاري البحث..." : `${products.length} منتج`}
            </p>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <ArrowUpDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
              <Select value={filters.sortBy} onValueChange={(value) => updateFilter("sortBy", value)}>
                <SelectTrigger className="w-full sm:w-48">
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
          </div>
        </div>

        <div className="flex gap-8">
          {/* Desktop Filters Sidebar */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <Card className="sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5" />
                  تصفية النتائج
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FiltersContent />
              </CardContent>
            </Card>
          </aside>

          {/* Products Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <SearchIcon className="h-16 w-16 mx-auto text-muted-foreground" />
                <h2 className="text-2xl font-bold">لا توجد نتائج</h2>
                <p className="text-muted-foreground">حاول تغيير معايير البحث أو الفلاتر</p>
                <Button onClick={resetFilters} variant="outline">
                  <RotateCcw className="h-4 w-4 ml-2" />
                  إعادة تعيين الفلاتر
                </Button>
              </div>
            ) : (
              <>
                {/* Ad: top of search results — high intent users */}
                <div className="mb-4">
                  <AdPlaceholder size="leaderboard" slot="search-top-leaderboard" />
                </div>
                <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">
                  {products.map((product, index) => {
                    const avgRating = getAverageRating(product.reviews);
                    const discount = product.original_price
                      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
                      : undefined;
                    return (
                      <Fragment key={product.id}>
                        {/* Native ad after every 4th product */}
                        {index > 0 && index % 4 === 0 && (() => {
                          const adIndex = Math.floor(index / 4) - 1;
                          const ad = nativeAds[adIndex % nativeAds.length];
                          return ad 
                            ? <NativeAdCard ad={ad} slot={`native-search-${adIndex}`} />
                            : <NativeAdCard slot={`native-search-${adIndex}`} />;
                        })()}
                        <ProductCard
                          id={product.id}
                          name={product.name}
                          price={product.price}
                          originalPrice={product.original_price || undefined}
                          image={product.image_url}
                          rating={avgRating}
                          reviews={product.reviews?.length || 0}
                          discount={discount}
                          shippingCost={(product as any).shipping_cost || 0}
                        />
                      </Fragment>
                    );
                  })}
                </div>
                {/* Ad: bottom banner */}
                <div className="mt-6">
                  <AdPlaceholder size="banner" slot="search-bottom-banner" />
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SearchPage;

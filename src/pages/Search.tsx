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
  DollarSign, User, Layers, ArrowUpDown, RotateCcw, Gem, Globe, Truck, Palette, Ruler, Percent
} from "lucide-react";
import { matchesSearchTerm } from "@/lib/search";
import { addRecentSearch } from "@/lib/searchHistory";

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
  product_type?: string | null;
  ships_within_days?: number | null;
  colors?: string[] | null;
  sizes?: string[] | null;
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
  colors: string[];
  sizes: string[];
  /** "" = all, "local" = Syria (seller), "turkey" = platform imports */
  country: string;
  /** Max preparation/shipping days; 0 = any */
  maxDeliveryDays: number;
  /** Minimum discount percentage; 0 = any */
  minDiscount: number;
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
  colors: [],
  sizes: [],
  country: "",
  maxDeliveryDays: 0,
  minDiscount: 0,
};

const FILTERS_STORAGE_KEY = "search_filters_v2";

const DELIVERY_OPTIONS = [
  { value: 0, label: "أي مدة" },
  { value: 2, label: "خلال يومين" },
  { value: 3, label: "خلال 3 أيام" },
  { value: 7, label: "خلال أسبوع" },
  { value: 14, label: "خلال أسبوعين" },
];

const DISCOUNT_OPTIONS = [10, 25, 50, 70];

const loadStoredFilters = (): Partial<Filters> | null => {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
  const [salesCounts, setSalesCounts] = useState<Map<string, number>>(new Map());
  const urlSearchQuery = searchParams.get("q")?.trim() || "";
  const urlBrandId = searchParams.get("brand")?.trim() || "";
  const [availableColors, setAvailableColors] = useState<string[]>([]);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);

  const [filters, setFilters] = useState<Filters>(() => {
    const stored = loadStoredFilters();
    return {
      ...defaultFilters,
      ...(stored || {}),
      // URL search query always wins on initial load if provided
      search: urlSearchQuery || stored?.search || "",
      brandIds: urlBrandId ? [urlBrandId] : stored?.brandIds ?? [],
    };
  });

  /** Uncontrolled-feel input with debounced commit, so typing stays fast. */
  const [searchInput, setSearchInput] = useState(() => urlSearchQuery);

  const [priceRange, setPriceRange] = useState<number[]>(() => {
    const stored = loadStoredFilters();
    return [stored?.minPrice ?? 0, stored?.maxPrice ?? 10000000];
  });

  // Persist filters whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      /* ignore quota errors */
    }
  }, [filters]);

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

      // Collect the color/size vocabulary actually used by live products.
      const { data: variantRows } = await supabase
        .from("products")
        .select("colors, sizes")
        .eq("is_active", true)
        .limit(1000);
      const colorSet = new Set<string>();
      const sizeSet = new Set<string>();
      (variantRows ?? []).forEach((row: any) => {
        (row.colors ?? []).forEach((c: string) => c && colorSet.add(c));
        (row.sizes ?? []).forEach((s: string) => s && sizeSet.add(s));
      });
      setAvailableColors([...colorSet].sort());
      setAvailableSizes([...sizeSet].sort());
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
    setSearchInput(urlSearchQuery);
  }, [urlSearchQuery]);

  // Debounced live search: commit the typed term after a short pause.
  useEffect(() => {
    if (searchInput === filters.search) return;
    const timer = window.setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput }));
      if (searchInput.trim().length >= 2) addRecentSearch(searchInput);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, filters.search]);

  // Search products when filters change
  useEffect(() => {
    searchProducts();
  }, [filters, salesCounts]);

  // Fetch sales counts once for best-selling sort
  useEffect(() => {
    const fetchSales = async () => {
      const { data } = await supabase
        .from("order_items")
        .select("product_id, quantity")
        .limit(5000);
      if (!data) return;
      const map = new Map<string, number>();
      data.forEach((row: any) => {
        if (!row.product_id) return;
        map.set(row.product_id, (map.get(row.product_id) || 0) + (row.quantity || 1));
      });
      setSalesCounts(map);
    };
    fetchSales();
  }, []);

  const searchProducts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("products")
        .select(
          "id, name, price, original_price, image_url, vendor_id, category_id, subcategory_id, stock_quantity, shipping_cost, product_type, ships_within_days, colors, sizes, reviews(rating)",
        )
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

      // Country of origin (local seller vs. imported platform products)
      if (filters.country === "local") {
        query = query.eq("product_type", "seller");
      } else if (filters.country === "turkey") {
        query = query.eq("product_type", "platform");
      }

      // Color / size variants
      if (filters.colors.length > 0) {
        query = query.overlaps("colors", filters.colors);
      }
      if (filters.sizes.length > 0) {
        query = query.overlaps("sizes", filters.sizes);
      }

      // Delivery time
      if (filters.maxDeliveryDays > 0) {
        query = query.lte("ships_within_days", filters.maxDeliveryDays);
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
        case "rating_desc":
        case "best_selling":
        case "discount_desc":
          // Sorted client-side after fetch
          query = query.order("created_at", { ascending: false });
          break;
        default:
          query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredProducts = (data || []) as Product[];

      // Minimum discount percentage (computed field)
      if (filters.minDiscount > 0) {
        filteredProducts = filteredProducts.filter((p) => {
          if (!p.original_price || p.original_price <= p.price) return false;
          return ((p.original_price - p.price) / p.original_price) * 100 >= filters.minDiscount;
        });
      }

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

      // Client-side sort for computed fields
      if (filters.sortBy === "rating_desc") {
        filteredProducts.sort((a, b) => {
          const ra = a.reviews?.length ? a.reviews.reduce((s, r) => s + r.rating, 0) / a.reviews.length : 0;
          const rb = b.reviews?.length ? b.reviews.reduce((s, r) => s + r.rating, 0) / b.reviews.length : 0;
          return rb - ra;
        });
      } else if (filters.sortBy === "discount_desc") {
        filteredProducts.sort((a, b) => {
          const da = a.original_price ? (a.original_price - a.price) / a.original_price : 0;
          const db = b.original_price ? (b.original_price - b.price) / b.original_price : 0;
          return db - da;
        });
      } else if (filters.sortBy === "best_selling") {
        filteredProducts.sort((a, b) => (salesCounts.get(b.id) || 0) - (salesCounts.get(a.id) || 0));
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

  const toggleVariant = (key: "colors" | "sizes", value: string) => {
    setFilters((prev) => {
      const list = prev[key];
      return {
        ...prev,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
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
    setSearchInput("");
    try {
      localStorage.removeItem(FILTERS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
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
    (filters.freeShipping ? 1 : 0) +
    filters.colors.length +
    filters.sizes.length +
    (filters.country ? 1 : 0) +
    (filters.maxDeliveryDays > 0 ? 1 : 0) +
    (filters.minDiscount > 0 ? 1 : 0);

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
            {filters.country && (
              <Badge variant="secondary" className="gap-1">
                {filters.country === "local" ? "🇸🇾 سوريا" : "🇹🇷 تركيا"}
                <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter("country", "")} />
              </Badge>
            )}
            {filters.colors.map((color) => (
              <Badge key={color} variant="secondary" className="gap-1">
                {color}
                <X className="h-3 w-3 cursor-pointer" onClick={() => toggleVariant("colors", color)} />
              </Badge>
            ))}
            {filters.sizes.map((size) => (
              <Badge key={size} variant="secondary" className="gap-1">
                مقاس {size}
                <X className="h-3 w-3 cursor-pointer" onClick={() => toggleVariant("sizes", size)} />
              </Badge>
            ))}
            {filters.maxDeliveryDays > 0 && (
              <Badge variant="secondary" className="gap-1">
                توصيل ≤ {filters.maxDeliveryDays} أيام
                <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter("maxDeliveryDays", 0)} />
              </Badge>
            )}
            {filters.minDiscount > 0 && (
              <Badge variant="secondary" className="gap-1">
                خصم {filters.minDiscount}%+
                <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter("minDiscount", 0)} />
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
                  <SelectItem value="best_selling">الأكثر مبيعاً</SelectItem>
                  <SelectItem value="rating_desc">الأعلى تقييماً</SelectItem>
                  <SelectItem value="discount_desc">الأعلى خصماً</SelectItem>
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
                <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">
                  {products.map((product, index) => {
                    const avgRating = getAverageRating(product.reviews);
                    const discount = product.original_price
                      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
                      : undefined;
                    return (
                      <Fragment key={product.id}>
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

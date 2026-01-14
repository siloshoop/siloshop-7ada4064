import { useState, useEffect, Suspense, lazy } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import HeroSection from "@/components/HeroSection";
import { SearchFilters } from "@/components/SearchFilters";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";
import {
  HeroSkeleton,
  CategorySkeleton,
  ProductGridSkeleton,
  DailyDealsSkeleton,
  RecentlyViewedSkeleton,
} from "@/components/HomeSkeleton";

// Lazy load components for better performance
const PopularCategories = lazy(() => import("@/components/PopularCategories"));
const EnhancedDailyDeals = lazy(() => import("@/components/EnhancedDailyDeals"));
const CategorySection = lazy(() => import("@/components/CategorySection"));
const PurchasedRecently = lazy(() => import("@/components/PurchasedRecently"));
const BestSellers = lazy(() => import("@/components/BestSellers"));
const RecentlyViewed = lazy(() => import("@/components/RecentlyViewed"));
const ProductRecommendations = lazy(() => import("@/components/ProductRecommendations"));
const FeaturedProducts = lazy(() => import("@/components/FeaturedProducts"));

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
}

const Index = () => {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    minPrice: 0,
    maxPrice: 1000000,
    categoryId: "",
    sortBy: "newest",
  });

  const searchQuery = searchParams.get("search");

  useEffect(() => {
    if (searchQuery) {
      searchProducts(searchQuery);
    }
  }, [searchQuery, filters]);

  const searchProducts = async (query: string) => {
    setLoading(true);
    try {
      let queryBuilder = supabase
        .from("products")
        .select("id, name, price, original_price, image_url, reviews(rating)")
        .eq("is_active", true)
        .ilike("name", `%${query}%`)
        .gte("price", filters.minPrice)
        .lte("price", filters.maxPrice);

      if (filters.categoryId) {
        queryBuilder = queryBuilder.eq("category_id", filters.categoryId);
      }

      // Apply sorting
      switch (filters.sortBy) {
        case "price_asc":
          queryBuilder = queryBuilder.order("price", { ascending: true });
          break;
        case "price_desc":
          queryBuilder = queryBuilder.order("price", { ascending: false });
          break;
        case "name_asc":
          queryBuilder = queryBuilder.order("name", { ascending: true });
          break;
        case "name_desc":
          queryBuilder = queryBuilder.order("name", { ascending: false });
          break;
        default:
          queryBuilder = queryBuilder.order("created_at", { ascending: false });
      }

      const { data } = await queryBuilder;
      setProducts(data || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (searchQuery) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold mb-2">نتائج البحث عن "{searchQuery}"</h1>
              <p className="text-muted-foreground">{products.length} منتج</p>
            </div>
            <SearchFilters onFilterChange={setFilters} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl text-muted-foreground">لا توجد نتائج</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  originalPrice={product.original_price || undefined}
                  image={product.image_url}
                  rating={4}
                  reviews={0}
                  discount={
                    product.original_price
                      ? Math.round(
                          ((product.original_price - product.price) /
                            product.original_price) *
                            100
                        )
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <Suspense fallback={<CategorySkeleton />}>
          <PopularCategories />
        </Suspense>
        <Suspense fallback={<DailyDealsSkeleton />}>
          <EnhancedDailyDeals />
        </Suspense>
        <Suspense fallback={<CategorySkeleton />}>
          <CategorySection />
        </Suspense>
        <Suspense fallback={<ProductGridSkeleton />}>
          <PurchasedRecently />
        </Suspense>
        <Suspense fallback={<ProductGridSkeleton />}>
          <BestSellers />
        </Suspense>
        <Suspense fallback={<RecentlyViewedSkeleton />}>
          <RecentlyViewed />
        </Suspense>
        <Suspense fallback={<ProductGridSkeleton />}>
          <ProductRecommendations />
        </Suspense>
        <Suspense fallback={<ProductGridSkeleton />}>
          <FeaturedProducts />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
};

export default Index;

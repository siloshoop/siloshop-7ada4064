import React, { useState, useEffect, useCallback, Fragment, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import PremiumShowroom from "@/components/PremiumShowroom";
import { SearchFilters } from "@/components/SearchFilters";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import PullToRefreshIndicator from "@/components/PullToRefresh";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import LazySection from "@/components/LazySection";

// Below-fold sections are lazy loaded to improve initial performance
const PopularCategories = lazy(() => import("@/components/PopularCategories"));
const BestSellers = lazy(() => import("@/components/BestSellers"));
const FeaturedProducts = lazy(() => import("@/components/FeaturedProducts"));
const ProductRecommendations = lazy(() => import("@/components/ProductRecommendations"));
const EnhancedDailyDeals = lazy(() => import("@/components/EnhancedDailyDeals"));
const PurchasedRecently = lazy(() => import("@/components/PurchasedRecently"));
const RecentlyViewed = lazy(() => import("@/components/RecentlyViewed"));

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
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({
    minPrice: 0,
    maxPrice: 1000000,
    categoryId: "",
    sortBy: "newest",
    brandId: "",
  });

  const searchQuery = searchParams.get("search");

  const handleRefresh = useCallback(async () => {
    setRefreshKey((prev) => prev + 1);
    await new Promise((resolve) => setTimeout(resolve, 800));
  }, []);

  const { containerRef, pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

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
              <h1 className="text-2xl font-bold mb-2 text-right">نتائج البحث عن "{searchQuery}"</h1>
              <p className="text-muted-foreground text-right">{products.length} منتج</p>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <Fragment key={product.id}>
                  <ProductCard
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
                </Fragment>
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col">
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
      />
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1 pb-[120px] md:pb-0 page-enter">
        <SectionErrorBoundary>
          <PremiumShowroom demoFallback />
        </SectionErrorBoundary>

        <LazySection>
          <SectionErrorBoundary>
            <PopularCategories key={`popular-${refreshKey}`} />
          </SectionErrorBoundary>
        </LazySection>

        <LazySection>
          <SectionErrorBoundary>
            <div id="daily-deals" style={{ scrollMarginTop: "80px" }}>
              <EnhancedDailyDeals key={`deals-${refreshKey}`} />
            </div>
          </SectionErrorBoundary>
        </LazySection>

        <LazySection>
          <SectionErrorBoundary>
            <PurchasedRecently key={`purchased-${refreshKey}`} />
          </SectionErrorBoundary>
        </LazySection>

        <LazySection>
          <SectionErrorBoundary>
            <BestSellers key={`bestsellers-${refreshKey}`} />
          </SectionErrorBoundary>
        </LazySection>

        <LazySection>
          <SectionErrorBoundary>
            <RecentlyViewed key={`recent-${refreshKey}`} />
          </SectionErrorBoundary>
        </LazySection>

        <LazySection>
          <SectionErrorBoundary>
            <ProductRecommendations key={`recommendations-${refreshKey}`} />
          </SectionErrorBoundary>
        </LazySection>

        <LazySection>
          <SectionErrorBoundary>
            <FeaturedProducts key={`featured-${refreshKey}`} />
          </SectionErrorBoundary>
        </LazySection>
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
};

export default Index;

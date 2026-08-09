import React, { useState, useEffect, useCallback, Fragment, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import HeroSlider from "@/components/home/HeroSlider";
import LocalMarketplaceBanner from "@/components/home/LocalMarketplaceBanner";
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
const TurkeyMarketplace = lazy(() => import("@/components/home/TurkeyMarketplace"));
const ProductRail = lazy(() => import("@/components/home/ProductRail"));
const FeaturedStores = lazy(() => import("@/components/home/FeaturedStores"));
const PopularCategories = lazy(() => import("@/components/PopularCategories"));
const BestSellers = lazy(() => import("@/components/BestSellers"));
const ProductRecommendations = lazy(() => import("@/components/ProductRecommendations"));
const EnhancedDailyDeals = lazy(() => import("@/components/EnhancedDailyDeals"));
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
        {/* Hero — full-width auto-rotating slider */}
        <SectionErrorBoundary>
          <HeroSlider />
        </SectionErrorBoundary>

        {/* 🇸🇾 Local Marketplace (Phase 1) */}
        <SectionErrorBoundary>
          <LocalMarketplaceBanner />
        </SectionErrorBoundary>

        {/* 🇹🇷 Shop From Turkey — renders nothing until the feature flag is on */}
        <SectionErrorBoundary>
          <Suspense fallback={null}>
            <TurkeyMarketplace />
          </Suspense>
        </SectionErrorBoundary>

        {/* Flash deals */}
        <LazySection>
          <SectionErrorBoundary>
            <div id="daily-deals" style={{ scrollMarginTop: "80px" }}>
              <EnhancedDailyDeals key={`deals-${refreshKey}`} />
            </div>
          </SectionErrorBoundary>
        </LazySection>

        {/* Today's offers */}
        <LazySection>
          <SectionErrorBoundary>
            <ProductRail
              key={`offers-${refreshKey}`}
              variant="todays_offers"
              icon={Tag}
              eyebrow="عروض اليوم"
              title="أفضل عروض اليوم"
              subtitle="منتجات بأسعار مخفّضة عن سعرها الأصلي"
              href="/search?sort=discount"
              tone="accent"
            />
          </SectionErrorBoundary>
        </LazySection>

        {/* New arrivals */}
        <LazySection>
          <SectionErrorBoundary>
            <ProductRail
              key={`new-${refreshKey}`}
              variant="new_arrivals"
              icon={Sparkles}
              eyebrow="وصل حديثاً"
              title="أحدث المنتجات"
              subtitle="آخر ما أضافه البائعون على سيلو شوب"
              href="/search?sort=newest"
            />
          </SectionErrorBoundary>
        </LazySection>

        {/* Best sellers */}
        <LazySection>
          <SectionErrorBoundary>
            <BestSellers key={`bestsellers-${refreshKey}`} />
          </SectionErrorBoundary>
        </LazySection>

        {/* Recommended for you */}
        <LazySection>
          <SectionErrorBoundary>
            <ProductRecommendations key={`recommendations-${refreshKey}`} />
          </SectionErrorBoundary>
        </LazySection>

        {/* Featured stores */}
        <LazySection>
          <SectionErrorBoundary>
            <FeaturedStores key={`stores-${refreshKey}`} />
          </SectionErrorBoundary>
        </LazySection>

        {/* Popular categories */}
        <LazySection>
          <SectionErrorBoundary>
            <PopularCategories key={`popular-${refreshKey}`} />
          </SectionErrorBoundary>
        </LazySection>

        {/* Recently viewed */}
        <LazySection>
          <SectionErrorBoundary>
            <RecentlyViewed key={`recent-${refreshKey}`} />
          </SectionErrorBoundary>
        </LazySection>
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
};

export default Index;

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import AnnouncementBar from "@/components/AnnouncementBar";
import HeroSection from "@/components/HeroSection";
import { SearchFilters } from "@/components/SearchFilters";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import StickyMobileAd from "@/components/StickyMobileAd";
import PullToRefreshIndicator from "@/components/PullToRefresh";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import AdPlaceholder from "@/components/AdPlaceholder";

// Import critical sections directly (not lazy) to prevent chunk loading failures
import PopularCategories from "@/components/PopularCategories";
import CategorySection from "@/components/CategorySection";
import BestSellers from "@/components/BestSellers";
import FeaturedProducts from "@/components/FeaturedProducts";
import ProductRecommendations from "@/components/ProductRecommendations";
import EnhancedDailyDeals from "@/components/EnhancedDailyDeals";
import PurchasedRecently from "@/components/PurchasedRecently";
import RecentlyViewed from "@/components/RecentlyViewed";

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
    <div ref={containerRef} className="min-h-screen flex flex-col">
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
      />
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1 pb-16 md:pb-0 page-enter">
        <HeroSection />

        <div className="container px-4 py-4">
          <AdPlaceholder size="leaderboard" slot="home-top-leaderboard" />
        </div>

        <SectionErrorBoundary>
          <PopularCategories key={`popular-${refreshKey}`} />
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <EnhancedDailyDeals key={`deals-${refreshKey}`} />
        </SectionErrorBoundary>

        <div className="container px-4 py-2">
          <AdPlaceholder size="banner" slot="home-mid-banner" />
        </div>

        <SectionErrorBoundary>
          <CategorySection key={`category-${refreshKey}`} />
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <PurchasedRecently key={`purchased-${refreshKey}`} />
        </SectionErrorBoundary>

        <div className="container px-4 py-2 flex justify-center">
          <AdPlaceholder size="rectangle" slot="home-mid-rectangle" />
        </div>

        <SectionErrorBoundary>
          <BestSellers key={`bestsellers-${refreshKey}`} />
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <RecentlyViewed key={`recent-${refreshKey}`} />
        </SectionErrorBoundary>

        <div className="container px-4 py-2">
          <AdPlaceholder size="interstitial" slot="home-interstitial" />
        </div>

        <SectionErrorBoundary>
          <ProductRecommendations key={`recommendations-${refreshKey}`} />
        </SectionErrorBoundary>
        <SectionErrorBoundary>
          <FeaturedProducts key={`featured-${refreshKey}`} />
        </SectionErrorBoundary>
      </main>
      <Footer />
      <StickyMobileAd />
      <MobileBottomNav />
    </div>
  );
};

export default Index;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Sparkles, Bell, BellOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Brand {
  id: string;
  name: string;
  name_ar: string;
  logo_url: string | null;
  product_count?: number;
  is_following?: boolean;
}

const BrandsSection = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [followingLoading, setFollowingLoading] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
    fetchBrands();
  }, []);

  useEffect(() => {
    if (user) {
      fetchFollowedBrands();
    }
  }, [user]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchBrands = async () => {
    try {
      const { data: brandsData } = await supabase
        .from("brands")
        .select("id, name, name_ar, logo_url")
        .eq("is_active", true)
        .order("name_ar");

      if (brandsData) {
        const brandsWithCounts = await Promise.all(
          brandsData.map(async (brand) => {
            const { count } = await supabase
              .from("products")
              .select("*", { count: "exact", head: true })
              .eq("brand_id", brand.id)
              .eq("is_active", true);

            return {
              ...brand,
              product_count: count || 0,
              is_following: false,
            };
          })
        );

        setBrands(brandsWithCounts);
      }
    } catch (error) {
      console.error("Error fetching brands:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowedBrands = async () => {
    if (!user) return;

    try {
      const { data: followedData } = await supabase
        .from("brand_followers")
        .select("brand_id")
        .eq("user_id", user.id);

      if (followedData) {
        const followedIds = followedData.map((f) => f.brand_id);
        setBrands((prev) =>
          prev.map((brand) => ({
            ...brand,
            is_following: followedIds.includes(brand.id),
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching followed brands:", error);
    }
  };

  const toggleFollow = async (e: React.MouseEvent, brandId: string) => {
    e.stopPropagation();

    if (!user) {
      toast({
        title: "تسجيل الدخول مطلوب",
        description: "يرجى تسجيل الدخول لمتابعة العلامات التجارية",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setFollowingLoading(brandId);
    const brand = brands.find((b) => b.id === brandId);
    const isCurrentlyFollowing = brand?.is_following;

    try {
      if (isCurrentlyFollowing) {
        // Unfollow
        await supabase
          .from("brand_followers")
          .delete()
          .eq("user_id", user.id)
          .eq("brand_id", brandId);

        setBrands((prev) =>
          prev.map((b) =>
            b.id === brandId ? { ...b, is_following: false } : b
          )
        );

        toast({
          title: "تم إلغاء المتابعة",
          description: `لن تتلقى إشعارات من ${brand?.name_ar}`,
        });
      } else {
        // Follow
        await supabase.from("brand_followers").insert({
          user_id: user.id,
          brand_id: brandId,
        });

        setBrands((prev) =>
          prev.map((b) =>
            b.id === brandId ? { ...b, is_following: true } : b
          )
        );

        toast({
          title: "تمت المتابعة بنجاح",
          description: `ستتلقى إشعارات عند إضافة منتجات جديدة من ${brand?.name_ar}`,
        });
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      toast({
        title: "حدث خطأ",
        description: "يرجى المحاولة مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setFollowingLoading(null);
    }
  };

  const handleBrandClick = (brandId: string) => {
    if (selectedBrand === brandId) {
      setSelectedBrand(null);
      navigate("/");
    } else {
      setSelectedBrand(brandId);
      navigate(`/search?brand=${brandId}`);
    }
  };

  const scroll = (direction: "left" | "right") => {
    const container = document.getElementById("brands-container");
    if (container) {
      const scrollAmount = 300;
      const newPosition =
        direction === "left"
          ? scrollPosition - scrollAmount
          : scrollPosition + scrollAmount;

      container.scrollTo({ left: newPosition, behavior: "smooth" });
      setScrollPosition(newPosition);
    }
  };

  const followedCount = brands.filter((b) => b.is_following).length;

  if (loading) {
    return (
      <section className="py-8 bg-gradient-to-b from-muted/30 to-background">
        <div className="container px-4">
          <div className="flex items-center gap-2 mb-6">
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-40 flex-shrink-0 rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (brands.length === 0) {
    return null;
  }

  return (
    <section className="py-8 bg-gradient-to-b from-muted/30 to-background overflow-hidden">
      <div className="container px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                العلامات التجارية
              </h2>
              <p className="text-sm text-muted-foreground">
                تصفح حسب الماركة المفضلة
                {followedCount > 0 && (
                  <span className="text-primary mr-2">
                    • تتابع {followedCount} علامة
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("right")}
              className="h-9 w-9 rounded-full border-border hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("left")}
              className="h-9 w-9 rounded-full border-border hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Brands Container */}
        <div
          id="brands-container"
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {/* All Brands Card */}
          <Card
            onClick={() => {
              setSelectedBrand(null);
              navigate("/search");
            }}
            className={`flex-shrink-0 w-40 h-36 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
              !selectedBrand
                ? "ring-2 ring-primary bg-primary/5"
                : "hover:border-primary/50"
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">
              جميع الماركات
            </span>
          </Card>

          {/* Brand Cards */}
          {brands.map((brand) => (
            <Card
              key={brand.id}
              onClick={() => handleBrandClick(brand.id)}
              className={`flex-shrink-0 w-40 h-36 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group relative ${
                selectedBrand === brand.id
                  ? "ring-2 ring-primary bg-primary/5"
                  : "hover:border-primary/50"
              } ${brand.is_following ? "border-primary/30" : ""}`}
            >
              {/* Follow Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => toggleFollow(e, brand.id)}
                disabled={followingLoading === brand.id}
                className={`absolute top-2 right-2 h-7 w-7 rounded-full transition-all ${
                  brand.is_following
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted/80 text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                }`}
              >
                {followingLoading === brand.id ? (
                  <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : brand.is_following ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Bell className="h-3.5 w-3.5" />
                )}
              </Button>

              {/* Product Count Badge */}
              {brand.product_count && brand.product_count > 0 && (
                <Badge
                  variant="secondary"
                  className="absolute top-2 left-2 text-xs bg-muted text-muted-foreground"
                >
                  {brand.product_count}
                </Badge>
              )}

              {/* Logo */}
              <div className="w-14 h-14 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden group-hover:border-primary/50 transition-colors">
                {brand.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt={brand.name_ar}
                    className="w-10 h-10 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <span
                  className={`text-lg font-bold text-primary ${
                    brand.logo_url ? "hidden" : ""
                  }`}
                >
                  {brand.name_ar.charAt(0)}
                </span>
              </div>

              {/* Brand Name */}
              <span className="text-sm font-medium text-foreground text-center line-clamp-1 px-2">
                {brand.name_ar}
              </span>

              {/* Following indicator */}
              {brand.is_following && (
                <span className="text-xs text-primary flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  متابَعة
                </span>
              )}
            </Card>
          ))}
        </div>

        {/* Selected Brand Indicator */}
        {selectedBrand && (
          <div className="mt-4 flex items-center justify-center">
            <Badge
              variant="outline"
              className="gap-2 px-4 py-2 bg-primary/5 border-primary/20"
            >
              <span className="text-muted-foreground">تصفية حسب:</span>
              <span className="font-medium text-foreground">
                {brands.find((b) => b.id === selectedBrand)?.name_ar}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBrand(null);
                  navigate("/");
                }}
                className="mr-1 text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </Badge>
          </div>
        )}
      </div>
    </section>
  );
};

export default BrandsSection;
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Bell, Check } from "lucide-react";
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
  const [user, setUser] = useState<any>(null);
  const [followingLoading, setFollowingLoading] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

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


  const followedCount = brands.filter((b) => b.is_following).length;

  if (loading) {
    return (
      <section className="py-6 bg-gradient-to-b from-muted/30 to-background">
        <div className="container px-4">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-6 w-40" />
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
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
    <section ref={sectionRef} className="py-6 bg-gradient-to-b from-muted/30 to-background">
      <div className="container px-4">
        {/* Header */}
        <div className={`flex items-center gap-2 mb-4 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="p-1.5 rounded-md bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-foreground">
              العلامات التجارية
            </h2>
            {followedCount > 0 && (
              <span className="text-xs text-primary">
                تتابع {followedCount} علامة
              </span>
            )}
          </div>
        </div>

        {/* Brands Grid */}
        <div className={`grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* All Brands Card */}
          <Card
            onClick={() => {
              setSelectedBrand(null);
              navigate("/search");
            }}
            className={`h-24 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-300 hover:shadow-md ${
              !selectedBrand
                ? "ring-2 ring-primary bg-primary/5"
                : "hover:border-primary/50"
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xs font-medium text-foreground">
              الكل
            </span>
          </Card>

          {/* Brand Cards */}
          {brands.slice(0, 7).map((brand) => (
            <Card
              key={brand.id}
              onClick={() => handleBrandClick(brand.id)}
              className={`h-24 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-300 hover:shadow-md group relative ${
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
                className={`absolute top-1 right-1 h-5 w-5 rounded-full transition-all ${
                  brand.is_following
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted/80 text-muted-foreground hover:bg-primary hover:text-primary-foreground opacity-0 group-hover:opacity-100"
                }`}
              >
                {followingLoading === brand.id ? (
                  <div className="h-2 w-2 border border-current border-t-transparent rounded-full animate-spin" />
                ) : brand.is_following ? (
                  <Check className="h-2.5 w-2.5" />
                ) : (
                  <Bell className="h-2.5 w-2.5" />
                )}
              </Button>

              {/* Logo */}
              <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden group-hover:border-primary/50 transition-colors">
                {brand.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt={brand.name_ar}
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <span
                  className={`text-sm font-bold text-primary ${
                    brand.logo_url ? "hidden" : ""
                  }`}
                >
                  {brand.name_ar.charAt(0)}
                </span>
              </div>

              {/* Brand Name */}
              <span className="text-xs font-medium text-foreground text-center line-clamp-1 px-1">
                {brand.name_ar}
              </span>
            </Card>
          ))}
        </div>

        {/* Selected Brand Indicator */}
        {selectedBrand && (
          <div className="mt-3 flex items-center justify-center">
            <Badge
              variant="outline"
              className="gap-1.5 px-3 py-1.5 bg-primary/5 border-primary/20 text-xs"
            >
              <span className="text-muted-foreground">تصفية:</span>
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
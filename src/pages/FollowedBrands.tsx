import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, Package, ArrowLeft, Sparkles } from "lucide-react";

interface FollowedBrand {
  id: string;
  brand_id: string;
  created_at: string;
  brand: {
    id: string;
    name: string;
    name_ar: string;
    logo_url: string | null;
  };
  product_count?: number;
}

const FollowedBrands = () => {
  const [followedBrands, setFollowedBrands] = useState<FollowedBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: "تسجيل الدخول مطلوب",
        description: "يرجى تسجيل الدخول لعرض الماركات المتابَعة",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    await fetchFollowedBrands(user.id);
  };

  const fetchFollowedBrands = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("brand_followers")
        .select(`
          id,
          brand_id,
          created_at,
          brand:brands(id, name, name_ar, logo_url)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        // Get product counts for each brand
        const brandsWithCounts = await Promise.all(
          data.map(async (item: any) => {
            const { count } = await supabase
              .from("products")
              .select("*", { count: "exact", head: true })
              .eq("brand_id", item.brand_id)
              .eq("is_active", true);

            return {
              ...item,
              product_count: count || 0,
            };
          })
        );

        setFollowedBrands(brandsWithCounts);
      }
    } catch (error) {
      console.error("Error fetching followed brands:", error);
      toast({
        title: "حدث خطأ",
        description: "تعذر تحميل الماركات المتابَعة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (brandFollowerId: string, brandName: string) => {
    setUnfollowingId(brandFollowerId);

    try {
      const { error } = await supabase
        .from("brand_followers")
        .delete()
        .eq("id", brandFollowerId);

      if (error) throw error;

      setFollowedBrands((prev) =>
        prev.filter((item) => item.id !== brandFollowerId)
      );

      toast({
        title: "تم إلغاء المتابعة",
        description: `لن تتلقى إشعارات من ${brandName}`,
      });
    } catch (error) {
      console.error("Error unfollowing brand:", error);
      toast({
        title: "حدث خطأ",
        description: "تعذر إلغاء المتابعة، يرجى المحاولة مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setUnfollowingId(null);
    }
  };

  const handleBrandClick = (brandId: string) => {
    navigate(`/search?brand=${brandId}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 container px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                الماركات المتابَعة
              </h1>
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "جارٍ التحميل..."
                  : `${followedBrands.length} ماركة متابَعة`}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            رجوع
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && followedBrands.length === 0 && (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-muted">
                <BellOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  لا توجد ماركات متابَعة
                </h3>
                <p className="text-muted-foreground mb-4">
                  تابع الماركات المفضلة لديك لتلقي إشعارات عند إضافة منتجات جديدة
                </p>
              </div>
              <Button onClick={() => navigate("/")} className="gap-2">
                <Sparkles className="h-4 w-4" />
                تصفح الماركات
              </Button>
            </div>
          </Card>
        )}

        {/* Followed Brands Grid */}
        {!loading && followedBrands.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {followedBrands.map((item) => (
              <Card
                key={item.id}
                className="overflow-hidden hover:shadow-lg transition-all duration-300 group"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Brand Logo */}
                    <div
                      onClick={() => handleBrandClick(item.brand_id)}
                      className="w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors flex-shrink-0"
                    >
                      {item.brand.logo_url ? (
                        <img
                          src={item.brand.logo_url}
                          alt={item.brand.name_ar}
                          className="w-12 h-12 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-xl font-bold text-primary">
                          {item.brand.name_ar.charAt(0)}
                        </span>
                      )}
                    </div>

                    {/* Brand Info */}
                    <div className="flex-1 min-w-0">
                      <h3
                        onClick={() => handleBrandClick(item.brand_id)}
                        className="font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                      >
                        {item.brand.name_ar}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {item.brand.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Package className="h-3 w-3" />
                          {item.product_count} منتج
                        </Badge>
                      </div>
                    </div>

                    {/* Unfollow Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnfollow(item.id, item.brand.name_ar)}
                      disabled={unfollowingId === item.id}
                      className="gap-2 text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground flex-shrink-0"
                    >
                      {unfollowingId === item.id ? (
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <BellOff className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">إلغاء المتابعة</span>
                    </Button>
                  </div>

                  {/* Follow Date */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      تمت المتابعة في{" "}
                      {new Date(item.created_at).toLocaleDateString("ar-EG", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default FollowedBrands;

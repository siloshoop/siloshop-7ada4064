import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package, TrendingUp, DollarSign, ShoppingBag, Loader2, Edit, Trash2, Search, Tag, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalProducts: 0, totalOrders: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        // Get profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        setProfile(profileData);

        if (profileData?.role === "vendor") {
          // Get vendor stats and products
          const { data: productsData } = await supabase
            .from("products")
            .select("*")
            .eq("vendor_id", user.id)
            .order("created_at", { ascending: false });

          setProducts(productsData || []);

          const { data: orderItems } = await supabase
            .from("order_items")
            .select("*")
            .eq("vendor_id", user.id);

          const totalRevenue = orderItems?.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) || 0;

          setStats({
            totalProducts: productsData?.length || 0,
            totalOrders: orderItems?.length || 0,
            totalRevenue,
          });

          // Get recent reviews
          const { data: reviewsData } = await supabase
            .from("reviews")
            .select(`
              *,
              products!inner(name, vendor_id),
              profiles(full_name)
            `)
            .eq("products.vendor_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5);

          setRecentReviews(reviewsData || []);
        }
      } catch (error: any) {
        toast({
          title: "خطأ",
          description: "فشل في جلب البيانات",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, toast]);

  // Filter and sort products
  useEffect(() => {
    let filtered = [...products];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(p => 
        filterStatus === "active" ? p.is_active : !p.is_active
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "date-asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "price-desc":
          return b.price - a.price;
        case "price-asc":
          return a.price - b.price;
        case "name-asc":
          return a.name.localeCompare(b.name, 'ar');
        case "name-desc":
          return b.name.localeCompare(a.name, 'ar');
        default:
          return 0;
      }
    });

    setFilteredProducts(filtered);
  }, [products, searchQuery, filterStatus, sortBy]);

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("vendor_id", user?.id);

      if (error) throw error;

      setProducts(products.filter(p => p.id !== productId));
      toast({
        title: "تم بنجاح",
        description: "تم حذف المنتج بنجاح",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (authLoading || loading) {
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

  const isVendor = profile?.role === "vendor";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            مرحباً، {profile?.full_name || "عزيزي المستخدم"}
          </h1>
          <p className="text-muted-foreground">
            {isVendor ? "إدارة منتجاتك وطلباتك" : "تصفح طلباتك ومشترياتك"}
          </p>
        </div>

        {isVendor ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي المنتجات</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalProducts}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">الطلبات</CardTitle>
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalOrders}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">الإيرادات</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalRevenue} ل.س</div>
              </CardContent>
              </Card>
            </div>

            {/* Recent Reviews Section */}
            {recentReviews.length > 0 && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>آخر التقييمات</CardTitle>
                  <CardDescription>آخر التقييمات على منتجاتك</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentReviews.map((review) => (
                      <div key={review.id} className="flex gap-4 pb-4 border-b last:border-0">
                        <Avatar>
                          <AvatarFallback>
                            {review.profiles?.full_name?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-semibold text-sm">
                                {review.profiles?.full_name || "مستخدم"}
                              </span>
                              <p className="text-xs text-muted-foreground">
                                {review.products?.name}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(review.created_at).toLocaleDateString('ar-SY')}
                            </span>
                          </div>
                          <div className="flex gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-4 w-4 ${
                                  star <= review.rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                          {review.comment && (
                            <p className="text-sm text-foreground/80">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <CardTitle>منتجاتي</CardTitle>
                    <CardDescription>إدارة منتجاتك المعروضة</CardDescription>
                  </div>
                   <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline"
                      onClick={() => navigate("/dashboard/orders")}
                    >
                      <ShoppingBag className="ml-2 h-4 w-4" />
                      الطلبات
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => navigate("/dashboard/statistics")}
                    >
                      <TrendingUp className="ml-2 h-4 w-4" />
                      الإحصائيات
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => navigate("/dashboard/coupons")}
                    >
                      <Tag className="ml-2 h-4 w-4" />
                      الكوبونات
                    </Button>
                    <Button onClick={() => navigate("/dashboard/add-product")}>
                      <Plus className="ml-2 h-4 w-4" />
                      إضافة منتج
                    </Button>
                  </div>
                </div>

                {products.length > 0 && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="بحث في المنتجات..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pr-10"
                        />
                      </div>

                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-full md:w-40">
                          <SelectValue placeholder="الحالة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          <SelectItem value="active">نشط</SelectItem>
                          <SelectItem value="inactive">غير نشط</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-full md:w-48">
                          <SelectValue placeholder="الترتيب" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date-desc">الأحدث أولاً</SelectItem>
                          <SelectItem value="date-asc">الأقدم أولاً</SelectItem>
                          <SelectItem value="price-desc">السعر: الأعلى</SelectItem>
                          <SelectItem value="price-asc">السعر: الأقل</SelectItem>
                          <SelectItem value="name-asc">الاسم: أ-ي</SelectItem>
                          <SelectItem value="name-desc">الاسم: ي-أ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {filteredProducts.length > 0 ? (
                  <div className="space-y-4">
                    {filteredProducts.map((product) => (
                      <div key={product.id} className="flex items-center gap-4 p-4 border rounded-lg">
                        <img
                          src={product.image_url || "/placeholder.svg"}
                          alt={product.name}
                          className="w-20 h-20 object-cover rounded-md"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{product.name}</h3>
                            <span className={`text-xs px-2 py-1 rounded ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {product.is_active ? 'نشط' : 'غير نشط'}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {product.price} ل.س
                          </p>
                          <p className="text-xs text-muted-foreground">
                            الكمية: {product.stock_quantity}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/dashboard/edit-product/${product.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : products.length > 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    لم يتم العثور على منتجات تطابق البحث
                  </p>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    لا توجد منتجات حالياً
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>طلباتي</CardTitle>
              <CardDescription>تتبع طلباتك ومشترياتك</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                لا توجد طلبات حالياً
              </p>
              <div className="text-center mt-4">
                <Button onClick={() => navigate("/")}>
                  تصفح المنتجات
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
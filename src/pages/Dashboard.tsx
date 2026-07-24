import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package, TrendingUp, DollarSign, ShoppingBag, Loader2, Edit, Trash2, Search, Tag, Star, Layers, Percent, Megaphone, Users, Activity, BarChart3, LayoutGrid, Heart, Settings, MessageSquare, CheckCircle2, XCircle, Undo2, Boxes } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import UserStatistics from "@/components/UserStatistics";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    returnedOrders: 0,
    productsSold: 0,
    estimatedRevenue: 0,
  });
  const [customerStats, setCustomerStats] = useState({ orders: 0, totalSpent: 0, reviewed: 0, favorites: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");
  const [isAdmin, setIsAdmin] = useState(false);
  const [sellerApp, setSellerApp] = useState<{ status: string; rejection_reason: string | null } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const fetchCustomerStats = useCallback(async (uid: string) => {
    const [ordersRes, favRes, reviewsRes] = await Promise.all([
      supabase.from("orders").select("total_amount, status").eq("customer_id", uid),
      supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", uid),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", uid),
    ]);
    const orders = ordersRes.data || [];
    // Successful orders = not cancelled; Revenue = delivered only
    const successfulOrders = orders.filter((o: any) => o.status !== "cancelled");
    const deliveredRevenue = orders
      .filter((o: any) => o.status === "delivered")
      .reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
    setCustomerStats({
      orders: successfulOrders.length,
      totalSpent: deliveredRevenue,
      reviewed: reviewsRes.count || 0,
      favorites: favRes.count || 0,
    });
  }, []);

  const fetchVendorStats = useCallback(async (uid: string) => {
    const { data: productsData } = await supabase
      .from("products")
      .select("*")
      .eq("vendor_id", uid)
      .order("created_at", { ascending: false });
    setProducts(productsData || []);
    const { data: salesStats } = await supabase.rpc("get_vendor_sales_stats");
    const s: any = Array.isArray(salesStats) ? salesStats[0] : salesStats;
    setStats({
      totalProducts: productsData?.length || 0,
      totalOrders: Number(s?.total_orders || 0),
      completedOrders: Number(s?.completed_orders || 0),
      cancelledOrders: Number(s?.cancelled_orders || 0),
      returnedOrders: Number(s?.returned_orders || 0),
      productsSold: Number(s?.products_sold || 0),
      estimatedRevenue: Number(s?.estimated_revenue || 0),
    });
  }, []);

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

        // Check if user is admin
        const { data: adminRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        setIsAdmin(!!adminRole);

        // Detect pending/rejected/suspended seller application
        const { data: appRow } = await supabase
          .from("seller_applications")
          .select("status, rejection_reason")
          .eq("user_id", user.id)
          .maybeSingle();
        if (appRow) setSellerApp(appRow as any);

        if (profileData?.role === "vendor") {
          await fetchVendorStats(user.id);

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
        } else {
          await fetchCustomerStats(user.id);
        }
      } catch (error) {
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
  }, [user, toast, fetchCustomerStats, fetchVendorStats]);

  // Realtime: keep customer dashboard stats in sync
  useEffect(() => {
    if (!user || profile?.role === "vendor") return;
    const refresh = () => fetchCustomerStats(user.id);
    const channel = supabase
      .channel(`dashboard-customer-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "favorites", filter: `user_id=eq.${user.id}` },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `customer_id=eq.${user.id}` },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews", filter: `user_id=eq.${user.id}` },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile?.role, fetchCustomerStats]);

  // Realtime: keep vendor sales stats in sync (orders/items/reviews changes)
  useEffect(() => {
    if (!user || profile?.role !== "vendor") return;
    const refresh = () => fetchVendorStats(user.id);
    const channel = supabase
      .channel(`dashboard-vendor-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "returns" },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile?.role, fetchVendorStats]);

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
    } catch (error) {
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

        {/* Admin User Statistics */}
        {isAdmin && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                إحصائيات المستخدمين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UserStatistics />
            </CardContent>
          </Card>
        )}

        {/* Admin quick link: seller management */}
        {isAdmin && (
          <Card className="mb-6 border-primary/30">
            <CardContent className="pt-6 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">إدارة البائعين</p>
                <p className="text-sm text-muted-foreground">مراجعة طلبات التسجيل واعتماد أو رفض البائعين.</p>
              </div>
              <Button onClick={() => navigate("/dashboard/sellers")}>فتح لوحة البائعين</Button>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card className="mb-6 border-primary/30">
            <CardContent className="pt-6 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">منتجات المنصة</p>
                <p className="text-sm text-muted-foreground">إضافة وتعديل واستيراد منتجات المنصة (Excel / CSV).</p>
              </div>
              <Button onClick={() => navigate("/dashboard/platform-products")}>فتح إدارة المنتجات</Button>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card className="mb-6 border-primary/30">
            <CardContent className="pt-6 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">البلاغات والإشراف</p>
                <p className="text-sm text-muted-foreground">مراجعة بلاغات المستخدمين واتخاذ إجراءات على المحتوى المخالف.</p>
              </div>
              <Button onClick={() => navigate("/dashboard/reports")}>فتح لوحة البلاغات</Button>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card className="mb-6 border-primary/30">
            <CardContent className="pt-6 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">إدارة الطلبات</p>
                <p className="text-sm text-muted-foreground">عرض كل الطلبات، البحث والفلترة، التتبع، الإلغاء، والاسترداد وتصدير CSV.</p>
              </div>
              <Button onClick={() => navigate("/dashboard/admin-orders")}>فتح إدارة الطلبات</Button>
            </CardContent>
          </Card>
        )}

        {/* Seller application status banner (pending/rejected/suspended) */}
        {sellerApp && sellerApp.status !== "approved" && (
          <Card className="mb-6 border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10">
            <CardContent className="pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {sellerApp.status === "pending" && "طلب البائع قيد المراجعة"}
                  {sellerApp.status === "rejected" && "تم رفض طلب البائع"}
                  {sellerApp.status === "suspended" && "حسابك كبائع موقوف حالياً"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {sellerApp.status === "pending" && "لا يمكنك الوصول إلى لوحة البائع حتى تتم الموافقة على طلبك."}
                  {sellerApp.status === "rejected" && (sellerApp.rejection_reason ?? "يمكنك تعديل بياناتك وإعادة التقديم.")}
                  {sellerApp.status === "suspended" && "يرجى التواصل مع الإدارة."}
                </p>
              </div>
              <Button onClick={() => navigate("/seller/application")}>عرض حالة الطلب</Button>
            </CardContent>
          </Card>
        )}

        {isVendor ? (
          <>
            <div className="mb-4 text-xs text-muted-foreground bg-muted/40 border rounded-md px-3 py-2">
              الدفع عند الاستلام فقط — يتم تحصيل المبلغ منك مباشرة من العميل عند التسليم. المنصة لا تحتفظ بأي أموال ولا تتقاضى أي عمولات.
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
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
                  <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalOrders}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">الطلبات المكتملة</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completedOrders}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">الطلبات الملغاة</CardTitle>
                  <XCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.cancelledOrders}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">الطلبات المرتجعة</CardTitle>
                  <Undo2 className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.returnedOrders}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">المنتجات المُباعة</CardTitle>
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.productsSold}</div>
                </CardContent>
              </Card>

              <Card className="col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">الإيرادات التقديرية (طلبات مُسلَّمة)</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.estimatedRevenue.toLocaleString('ar-SY')} ل.س</div>
                  <p className="text-xs text-muted-foreground mt-1">قيمة تقديرية للطلبات التي تم تسليمها فقط. يتم تحصيلها منك مباشرة من العميل عند الاستلام.</p>
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
                    <Button 
                      variant="outline"
                      onClick={() => navigate("/dashboard/subcategories")}
                    >
                      <Layers className="ml-2 h-4 w-4" />
                      التصنيفات
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => navigate("/dashboard/deals")}
                    >
                      <Percent className="ml-2 h-4 w-4" />
                      العروض
                    </Button>
                    {isAdmin && (
                      <>
                        <Button 
                          variant="outline"
                          onClick={() => navigate("/dashboard/announcements")}
                        >
                          <Megaphone className="ml-2 h-4 w-4" />
                          الإعلانات
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => navigate("/dashboard/native-ads")}
                        >
                          <LayoutGrid className="ml-2 h-4 w-4" />
                          الإعلانات المدمجة
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => navigate("/dashboard/users")}
                        >
                          <Users className="ml-2 h-4 w-4" />
                          المستخدمين
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => navigate("/dashboard/activity-logs")}
                        >
                          <Activity className="ml-2 h-4 w-4" />
                          سجل النشاطات
                        </Button>
                      </>
                    )}
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
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">عدد الطلبات</CardTitle>
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{customerStats.orders}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">المبلغ الإجمالي</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{customerStats.totalSpent.toLocaleString()} ل.س</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">منتجات مقيّمة</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{customerStats.reviewed}</div>
                  <Progress
                    value={customerStats.orders > 0 ? Math.min(100, (customerStats.reviewed / customerStats.orders) * 100) : 0}
                    className="mt-2 h-1.5"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">نسبة التقييم من طلباتك</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">المفضلة</CardTitle>
                  <Heart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{customerStats.favorites}</div></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>الوصول السريع</CardTitle>
                <CardDescription>تنقّل سريعاً إلى أهم الصفحات</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button variant="outline" className="h-20 flex-col gap-1" onClick={() => navigate("/orders")}>
                    <ShoppingBag className="h-5 w-5" />
                    <span>طلباتي</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-1" onClick={() => navigate("/favorites")}>
                    <Heart className="h-5 w-5" />
                    <span>المفضلة</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-1" onClick={() => navigate("/messages")}>
                    <MessageSquare className="h-5 w-5" />
                    <span>الرسائل</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-1" onClick={() => navigate("/settings")}>
                    <Settings className="h-5 w-5" />
                    <span>الإعدادات</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
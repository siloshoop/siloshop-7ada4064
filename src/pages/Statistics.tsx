import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2, TrendingUp, Package, DollarSign, ShoppingCart, Star } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, eachWeekOfInterval, subMonths } from "date-fns";
import { ar } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface WeeklyStat {
  week: string;
  sales: number;
  revenue: number;
  orders: number;
}

interface ProductStat {
  name: string;
  sales: number;
  revenue: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  products: {
    name: string;
  };
  profiles: {
    full_name: string;
  };
}

const Statistics = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<WeeklyStat[]>([]);
  const [topProducts, setTopProducts] = useState<ProductStat[]>([]);
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalStats, setTotalStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    averageOrder: 0,
  });

  useEffect(() => {
    if (!user) return;

    const fetchStatistics = async () => {
      setLoading(true);

      // Fetch weekly data for the last 12 weeks
      const weeks = eachWeekOfInterval({
        start: subMonths(new Date(), 3),
        end: new Date(),
      });

      const weeklyStats: WeeklyStat[] = await Promise.all(
        weeks.map(async (weekStart) => {
          const weekEnd = endOfWeek(weekStart, { locale: ar });

          const { data: orderItems } = await supabase
            .from("order_items")
            .select("*, orders!inner(*)")
            .eq("vendor_id", user.id)
            .gte("orders.created_at", weekStart.toISOString())
            .lte("orders.created_at", weekEnd.toISOString());

          const revenue = orderItems?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
          const orders = new Set(orderItems?.map(item => item.order_id)).size;

          return {
            week: format(weekStart, "dd MMM", { locale: ar }),
            sales: orderItems?.length || 0,
            revenue,
            orders,
          };
        })
      );

      setWeeklyData(weeklyStats);

      // Fetch top products
      const { data: allOrderItems } = await supabase
        .from("order_items")
        .select("*, products(*)")
        .eq("vendor_id", user.id);

      const productMap = new Map<string, ProductStat>();
      allOrderItems?.forEach((item: any) => {
        const productName = item.products?.name || "Unknown";
        const existing = productMap.get(productName) || { name: productName, sales: 0, revenue: 0 };
        productMap.set(productName, {
          name: productName,
          sales: existing.sales + item.quantity,
          revenue: existing.revenue + (item.price * item.quantity),
        });
      });

      const sortedProducts = Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setTopProducts(sortedProducts);

      // Calculate total stats
      const totalRevenue = weeklyStats.reduce((sum, week) => sum + week.revenue, 0);
      const totalOrders = weeklyStats.reduce((sum, week) => sum + week.orders, 0);

      const { data: products } = await supabase
        .from("products")
        .select("id")
        .eq("vendor_id", user.id);

      setTotalStats({
        totalRevenue,
        totalOrders,
        totalProducts: products?.length || 0,
        averageOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      });

      // Fetch recent reviews
      const { data: reviews } = await supabase
        .from("reviews")
        .select(`
          *,
          products!inner(name, vendor_id),
          profiles(full_name)
        `)
        .eq("products.vendor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (reviews) {
        setRecentReviews(reviews as any);
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;
        setAverageRating(Math.round(avgRating * 10) / 10);
      }

      setLoading(false);
    };

    fetchStatistics();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const COLORS = ['#9333ea', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">لوحة الإحصائيات</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
              <p className="text-2xl font-bold">{totalStats.totalRevenue.toFixed(2)} ل.س</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
              <p className="text-2xl font-bold">{totalStats.totalOrders}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي المنتجات</p>
              <p className="text-2xl font-bold">{totalStats.totalProducts}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">متوسط قيمة الطلب</p>
              <p className="text-2xl font-bold">{totalStats.averageOrder.toFixed(2)} ل.س</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Rating Summary */}
      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold mb-2">متوسط التقييمات</h2>
            <p className="text-muted-foreground">بناءً على {recentReviews.length} تقييم</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-4xl font-bold">{averageRating}</span>
            <Star className="h-8 w-8 fill-yellow-400 text-yellow-400" />
          </div>
        </div>
      </Card>

      {/* Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">الإيرادات</TabsTrigger>
          <TabsTrigger value="orders">الطلبات</TabsTrigger>
          <TabsTrigger value="products">أفضل المنتجات</TabsTrigger>
          <TabsTrigger value="reviews">التقييمات</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">الإيرادات الأسبوعية</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#9333ea" name="الإيرادات (ل.س)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">الطلبات الأسبوعية</h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="orders" fill="#9333ea" name="عدد الطلبات" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">أفضل 5 منتجات مبيعاً</h2>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={topProducts}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={150}
                  label
                >
                  {topProducts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">آخر التقييمات</h2>
            {recentReviews.length > 0 ? (
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
                          <span className="font-semibold">
                            {review.profiles?.full_name || "مستخدم"}
                          </span>
                          <p className="text-sm text-muted-foreground">
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
            ) : (
              <p className="text-center text-muted-foreground py-8">
                لا توجد تقييمات بعد
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Statistics;

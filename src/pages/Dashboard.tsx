import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Package, TrendingUp, DollarSign, ShoppingBag, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ totalProducts: 0, totalOrders: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
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
          // Get vendor stats
          const { data: products } = await supabase
            .from("products")
            .select("*")
            .eq("vendor_id", user.id);

          const { data: orderItems } = await supabase
            .from("order_items")
            .select("*")
            .eq("vendor_id", user.id);

          const totalRevenue = orderItems?.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) || 0;

          setStats({
            totalProducts: products?.length || 0,
            totalOrders: orderItems?.length || 0,
            totalRevenue,
          });
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
                  <div className="text-2xl font-bold">{stats.totalRevenue} ريال</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>منتجاتي</CardTitle>
                    <CardDescription>إدارة منتجاتك المعروضة</CardDescription>
                  </div>
                  <Button onClick={() => navigate("/dashboard/add-product")}>
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة منتج
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  سيتم عرض منتجاتك هنا
                </p>
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
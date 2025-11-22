import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Loader2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface Order {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  order_items: {
    product: {
      name: string;
      image_url: string;
    };
    quantity: number;
    price: number;
  }[];
}

const Orders = () => {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("orders")
          .select(`
            id,
            created_at,
            total_amount,
            status,
            order_items(
              quantity,
              price,
              product:products(name, image_url)
            )
          `)
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setOrders(data as any || []);
      } catch (error: any) {
        toast({
          title: "خطأ",
          description: "فشل في جلب الطلبات",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user, toast]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "قيد المعالجة", variant: "secondary" },
      confirmed: { label: "مؤكد", variant: "default" },
      shipped: { label: "جاري التوصيل", variant: "outline" },
      delivered: { label: "تم التوصيل", variant: "default" },
      cancelled: { label: "ملغي", variant: "destructive" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">طلباتي</h1>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <Package className="h-16 w-16 mx-auto text-muted-foreground" />
              <h2 className="text-2xl font-bold">لا توجد طلبات</h2>
              <p className="text-muted-foreground">
                لم تقم بإجراء أي طلبات بعد
              </p>
              <Button onClick={() => navigate("/")}>
                تصفح المنتجات
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        رقم الطلب: <span className="font-mono">{order.id.slice(0, 8)}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        التاريخ: {format(new Date(order.created_at), "dd MMMM yyyy", { locale: ar })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 mt-4 md:mt-0">
                      {getStatusBadge(order.status)}
                      <p className="font-bold text-lg text-primary">
                        {order.total_amount} ريال
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {order.order_items.map((item, index) => (
                      <div key={index} className="flex gap-4 p-3 bg-muted/30 rounded-lg">
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold">{item.product.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            الكمية: {item.quantity} × {item.price} ريال
                          </p>
                        </div>
                      </div>
                    ))}
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

export default Orders;
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Order {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  shipping_address: string;
  customer_id: string;
  profiles: {
    full_name: string;
    phone: string;
  };
}

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  products: {
    name: string;
    image_url: string;
  };
}

const VendorOrders = () => {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
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
        // Get all order items for vendor's products
        const { data: vendorOrderItems, error: itemsError } = await supabase
          .from("order_items")
          .select(`
            id,
            order_id,
            quantity,
            price,
            products (
              name,
              image_url
            )
          `)
          .eq("vendor_id", user.id);

        if (itemsError) throw itemsError;

        // Get unique order IDs
        const orderIds = [...new Set(vendorOrderItems?.map(item => item.order_id))];

        if (orderIds.length > 0) {
          // Get order details
          const { data: ordersData, error: ordersError } = await supabase
            .from("orders")
            .select(`
              id,
              created_at,
              status,
              total_amount,
              shipping_address,
              customer_id,
              profiles (
                full_name,
                phone
              )
            `)
            .in("id", orderIds)
            .order("created_at", { ascending: false });

          if (ordersError) throw ordersError;

          setOrders(ordersData || []);

          // Group items by order
          const groupedItems: Record<string, OrderItem[]> = {};
          vendorOrderItems?.forEach(item => {
            if (!groupedItems[item.order_id]) {
              groupedItems[item.order_id] = [];
            }
            groupedItems[item.order_id].push(item as OrderItem);
          });
          setOrderItems(groupedItems);
        }
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
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "قيد الانتظار", variant: "secondary" },
      processing: { label: "قيد المعالجة", variant: "default" },
      shipped: { label: "تم الشحن", variant: "outline" },
      delivered: { label: "تم التوصيل", variant: "default" },
      cancelled: { label: "ملغى", variant: "destructive" },
    };
    
    const statusInfo = statusMap[status] || statusMap.pending;
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const filterOrders = (status: string) => {
    if (status === "all") return orders;
    return orders.filter(order => order.status === status);
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

  const filteredOrders = filterOrders(activeTab);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">إدارة الطلبات</h1>
          <p className="text-muted-foreground">تتبع وإدارة طلبات عملائك</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>الطلبات</CardTitle>
            <CardDescription>جميع الطلبات على منتجاتك</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">الكل</TabsTrigger>
                <TabsTrigger value="pending">قيد الانتظار</TabsTrigger>
                <TabsTrigger value="processing">قيد المعالجة</TabsTrigger>
                <TabsTrigger value="shipped">تم الشحن</TabsTrigger>
                <TabsTrigger value="delivered">تم التوصيل</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-6">
                {filteredOrders.length > 0 ? (
                  <div className="space-y-4">
                    {filteredOrders.map((order) => (
                      <Card key={order.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">
                                طلب #{order.id.slice(0, 8)}
                              </CardTitle>
                              <CardDescription>
                                {new Date(order.created_at).toLocaleDateString('ar-SY', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </CardDescription>
                            </div>
                            {getStatusBadge(order.status)}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium">العميل</p>
                                <p className="text-sm text-muted-foreground">
                                  {order.profiles?.full_name || "غير متوفر"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {order.profiles?.phone || "لا يوجد رقم"}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium">عنوان التوصيل</p>
                                <p className="text-sm text-muted-foreground">
                                  {order.shipping_address || "غير محدد"}
                                </p>
                              </div>
                            </div>

                            {orderItems[order.id] && (
                              <div>
                                <p className="text-sm font-medium mb-2">المنتجات</p>
                                <div className="space-y-2">
                                  {orderItems[order.id].map((item) => (
                                    <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                      <img
                                        src={item.products.image_url || "/placeholder.svg"}
                                        alt={item.products.name}
                                        className="w-12 h-12 object-cover rounded"
                                      />
                                      <div className="flex-1">
                                        <p className="text-sm font-medium">{item.products.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          الكمية: {item.quantity} × {item.price} ل.س
                                        </p>
                                      </div>
                                      <p className="text-sm font-semibold">
                                        {item.quantity * item.price} ل.س
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {activeTab === "all" 
                        ? "لا توجد طلبات حالياً" 
                        : `لا توجد طلبات ${activeTab === "pending" ? "قيد الانتظار" : activeTab === "processing" ? "قيد المعالجة" : activeTab === "shipped" ? "تم شحنها" : "تم توصيلها"}`
                      }
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default VendorOrders;

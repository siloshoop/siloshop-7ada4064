import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Package, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface Order {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  shipping_address: string;
  customer_id: string;
  profiles: {
    full_name: string;
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

// Utility function to mask sensitive data
const maskPhone = (phone: string | null): string => {
  if (!phone) return "غير متوفر";
  // Show only last 4 digits
  if (phone.length > 4) {
    return "****" + phone.slice(-4);
  }
  return "****";
};

// Utility function to get city/region from address
const getPartialAddress = (address: string | null): string => {
  if (!address) return "غير محدد";
  // Extract city/region (first part before comma or first 30 chars)
  const parts = address.split(',');
  if (parts.length > 1) {
    return parts[0].trim() + "، ...";
  }
  if (address.length > 30) {
    return address.slice(0, 30) + "...";
  }
  return address;
};

const VendorOrders = () => {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [revealedOrders, setRevealedOrders] = useState<Set<string>>(new Set());
  const [fullAddresses, setFullAddresses] = useState<Record<string, string>>({});
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
          // Get order details - only fetch necessary fields for display
          // Note: We deliberately exclude phone from profiles to minimize PII exposure
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
                full_name
              )
            `)
            .in("id", orderIds)
            .order("created_at", { ascending: false });

          if (ordersError) throw ordersError;

          setOrders(ordersData || []);

          // Store full addresses for optional reveal
          const addresses: Record<string, string> = {};
          ordersData?.forEach(order => {
            if (order.shipping_address) {
              addresses[order.id] = order.shipping_address;
            }
          });
          setFullAddresses(addresses);

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

  const toggleRevealAddress = (orderId: string) => {
    setRevealedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

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
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium">عنوان التوصيل</p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => toggleRevealAddress(order.id)}
                                    title={revealedOrders.has(order.id) ? "إخفاء العنوان الكامل" : "عرض العنوان الكامل"}
                                  >
                                    {revealedOrders.has(order.id) ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {revealedOrders.has(order.id)
                                    ? fullAddresses[order.id] || "غير محدد"
                                    : getPartialAddress(order.shipping_address)}
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

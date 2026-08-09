import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Package, Eye, EyeOff, Truck } from "lucide-react";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import OrderTimelineLog from "@/components/orders/OrderTimelineLog";
import ShippingInfoDialog from "@/components/orders/ShippingInfoDialog";
import { allowedNextStatuses, changeOrderStatus, friendlyOrderError, normalizeStatus, type OrderStatus } from "@/lib/orderStatus";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
interface Order {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  customer_name: string;
  city: string | null;
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

// City is now returned directly by the secure RPC, already minimised.
const getPartialAddress = (city: string | null): string => city || "غير محدد";

const VendorOrders = () => {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  // Sensitive PII (full address, phone, coordinates, coupon) is no longer
  // available to vendors per security hardening. Reveal toggle is therefore
  // a no-op kept only to preserve existing UI structure.
  const [revealedOrders] = useState<Set<string>>(new Set());
  const [fullAddresses] = useState<Record<string, string>>({});
  
  // Shipping dialog state
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false);
  const [pendingShipOrderId, setPendingShipOrderId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courierName, setCourierName] = useState("");
  
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
        // 1. Fetch orders via secure RPC (returns empty array when the vendor has none).
        const { data: ordersData, error: ordersError } = await supabase.rpc("get_vendor_orders");

        if (ordersError) {
          console.error("get_vendor_orders error:", ordersError);
          toast({
            title: "خطأ",
            description: ordersError.message || "فشل في جلب الطلبات",
            variant: "destructive",
          });
          setOrders([]);
          setOrderItems({});
          return;
        }

        const orders = (ordersData as Order[]) || [];
        setOrders(orders);

        if (orders.length === 0) {
          setOrderItems({});
          return;
        }

        // 2. Fetch product line items only for this vendor's orders.
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
          .eq("vendor_id", user.id)
          .in("order_id", orders.map((o) => o.id));

        if (itemsError) {
          console.error("order_items fetch error:", itemsError);
          // Non-fatal: still show orders without line items.
          setOrderItems({});
          return;
        }

        const groupedItems: Record<string, OrderItem[]> = {};
        (vendorOrderItems || []).forEach((item: any) => {
          if (!groupedItems[item.order_id]) groupedItems[item.order_id] = [];
          groupedItems[item.order_id].push(item as OrderItem);
        });
        setOrderItems(groupedItems);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user, toast]);

  const toggleRevealAddress = (_orderId: string) => {
    // No-op: full address is no longer exposed to vendors.
  };

  const getStatusBadge = (status: string) => {
    return <OrderStatusBadge status={status} />;
  };

  const filterOrders = (status: string) => {
    if (status === "all") return orders;
    return orders.filter(order => normalizeStatus(order.status) === status);
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateOrderStatus(orderId, newStatus as OrderStatus);
  };

  const openShippingDialog = (orderId: string) => {
    setPendingShipOrderId(orderId);
    setShippingDialogOpen(true);
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingStatus(orderId);
    try {
      // Audited, transition-validated update (records actor, IP and device server side).
      await changeOrderStatus(orderId, newStatus);

      setOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      toast({
        title: "تم التحديث",
        description: "تم تحديث حالة الطلب بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: friendlyOrderError(error),
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(null);
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
                                  {order.customer_name || "غير متوفر"}
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
                                  {getPartialAddress(order.city)}
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

                            {/* Status Update Section */}
                            <div className="border-t pt-4 mt-4">
                              <div className="flex flex-wrap items-center gap-3">
                                <p className="text-sm font-medium">تحديث الحالة:</p>
                                <Select
                                  value=""
                                  onValueChange={(value) => handleStatusChange(order.id, value)}
                                  disabled={updatingStatus === order.id}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="اختر الحالة التالية" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background">
                                    {allowedNextStatuses(order.status, "seller").map((s) => (
                                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button variant="outline" size="sm" className="gap-2"
                                  onClick={() => openShippingDialog(order.id)}>
                                  <Truck className="h-4 w-4" />
                                  معلومات الشحن
                                </Button>
                                {updatingStatus === order.id && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                              </div>
                            </div>

                            <div className="border-t pt-4">
                              <p className="text-sm font-medium mb-3">سجل الطلب</p>
                              <OrderTimelineLog orderId={order.id} />
                            </div>
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

      {/* Shipping Dialog */}
      <Dialog open={shippingDialogOpen} onOpenChange={setShippingDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              معلومات الشحن
            </DialogTitle>
            <DialogDescription>
              أدخل معلومات تتبع الشحن للعميل (اختياري)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="courierName">شركة الشحن</Label>
              <Input
                id="courierName"
                placeholder="مثال: أرامكس، DHL، سمسا"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="trackingNumber">رقم التتبع</Label>
              <Input
                id="trackingNumber"
                placeholder="أدخل رقم تتبع الشحنة"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShippingDialogOpen(false)}
              disabled={updatingStatus === pendingShipOrderId}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleShippingConfirm}
              disabled={updatingStatus === pendingShipOrderId}
            >
              {updatingStatus === pendingShipOrderId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري التحديث...
                </>
              ) : (
                "تأكيد الشحن"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorOrders;

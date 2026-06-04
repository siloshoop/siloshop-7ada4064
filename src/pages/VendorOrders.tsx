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

        const orderIds = [...new Set(vendorOrderItems?.map(item => item.order_id))];

        if (orderIds.length > 0) {
          // Use secure RPC that returns only fulfillment-relevant fields
          // (no phone, full address, coordinates, or coupon code).
          const { data: ordersData, error: ordersError } = await supabase
            .rpc("get_vendor_orders");

          if (ordersError) throw ordersError;

          setOrders((ordersData as Order[]) || []);

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

  const toggleRevealAddress = (_orderId: string) => {
    // No-op: full address is no longer exposed to vendors.
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

  const handleStatusChange = (orderId: string, newStatus: string) => {
    if (newStatus === "shipped") {
      // Open shipping dialog for tracking info
      setPendingShipOrderId(orderId);
      setTrackingNumber("");
      setCourierName("");
      setShippingDialogOpen(true);
    } else {
      updateOrderStatus(orderId, newStatus);
    }
  };

  const handleShippingConfirm = async () => {
    if (!pendingShipOrderId) return;
    
    setUpdatingStatus(pendingShipOrderId);
    try {
      // Update order status via SECURITY DEFINER RPC (avoids exposing customer PII through UPDATE RLS).
      const { error: orderError } = await supabase.rpc("vendor_update_order_status", {
        _order_id: pendingShipOrderId,
        _status: "shipped",
        _tracking_number: trackingNumber || null,
        _courier_name: courierName || null,
      });

      if (orderError) throw orderError;

      // Add to status history
      const { error: historyError } = await supabase
        .from("order_status_history")
        .insert({
          order_id: pendingShipOrderId,
          status: "shipped",
          notes: trackingNumber ? `رقم التتبع: ${trackingNumber}${courierName ? ` - شركة الشحن: ${courierName}` : ''}` : null,
        });

      if (historyError) throw historyError;

      // Send email notification to customer
      try {
        await supabase.functions.invoke("notify-customer-order-status", {
          body: {
            order_id: pendingShipOrderId,
            new_status: "shipped",
            notes: trackingNumber ? `رقم التتبع: ${trackingNumber}` : undefined,
          },
        });
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
      }

      // Update local state
      setOrders(prev =>
        prev.map(order =>
          order.id === pendingShipOrderId ? { ...order, status: "shipped" } : order
        )
      );

      toast({
        title: "تم التحديث",
        description: "تم تحديث حالة الطلب وإضافة معلومات الشحن",
      });

      setShippingDialogOpen(false);
      setPendingShipOrderId(null);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل في تحديث حالة الطلب",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(orderId);
    try {
      // Update order status via SECURITY DEFINER RPC.
      const { error: orderError } = await supabase.rpc("vendor_update_order_status", {
        _order_id: orderId,
        _status: newStatus,
      });

      if (orderError) throw orderError;

      // Add to status history
      const { error: historyError } = await supabase
        .from("order_status_history")
        .insert({
          order_id: orderId,
          status: newStatus,
        });

      if (historyError) throw historyError;

      // Send email notification to customer
      try {
        await supabase.functions.invoke("notify-customer-order-status", {
          body: {
            order_id: orderId,
            new_status: newStatus,
          },
        });
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
      }

      // Update local state
      setOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      toast({
        title: "تم التحديث",
        description: "تم تحديث حالة الطلب بنجاح",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل في تحديث حالة الطلب",
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
                              <div className="flex items-center gap-4">
                                <p className="text-sm font-medium">تحديث الحالة:</p>
                                <Select
                                  value={order.status}
                                  onValueChange={(value) => handleStatusChange(order.id, value)}
                                  disabled={updatingStatus === order.id}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="اختر الحالة" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background">
                                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                                    <SelectItem value="processing">قيد المعالجة</SelectItem>
                                    <SelectItem value="shipped">تم الشحن</SelectItem>
                                    <SelectItem value="delivered">تم التوصيل</SelectItem>
                                    <SelectItem value="cancelled">ملغى</SelectItem>
                                  </SelectContent>
                                </Select>
                                {updatingStatus === order.id && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                              </div>
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

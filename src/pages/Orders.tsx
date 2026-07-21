import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import DeliveryRating from "@/components/DeliveryRating";
import ReorderButton from "@/components/ReorderButton";
import CancelOrderDialog from "@/components/CancelOrderDialog";
import ReturnRequestDialog from "@/components/ReturnRequestDialog";
import { RETURN_STATUS } from "@/lib/returnStatus";

interface OrderItem {
  product_id: string;
  product: {
    name: string;
    image_url: string;
  } | null;
  quantity: number;
  price: number;
}

interface OrderRecord {
  id: string;
  created_at: string;
  total_amount: number;
  status: string | null;
  delivered_at: string | null;
}

interface OrderItemRecord {
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  product: {
    name: string | null;
    image_url: string | null;
  } | null;
}

interface DeliveryRatingData {
  order_id: string;
  rating: number;
}

interface ReturnData {
  order_id: string;
  status: string;
  created_at: string;
}

interface Order {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  delivered_at: string | null;
  order_items: OrderItem[];
  delivery_rating?: DeliveryRatingData | null;
  return?: ReturnData | null;
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

  const fetchOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, created_at, total_amount, status, delivered_at")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Orders fetch error:", ordersError);
        setOrders([]);
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      const orderIds = ordersData.map((order) => order.id);

      const [itemsRes, ratingsRes, returnsRes] = await Promise.allSettled([
        supabase
          .from("order_items")
          .select(`
            order_id,
            product_id,
            quantity,
            price,
            product:products(name, image_url)
          `)
          .in("order_id", orderIds),
        supabase
          .from("delivery_ratings")
          .select("order_id, rating")
          .in("order_id", orderIds),
        supabase
          .from("returns")
          .select("order_id, status, created_at")
          .in("order_id", orderIds)
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      const orderItemsData =
        itemsRes.status === "fulfilled" ? itemsRes.value.data : null;
      if (itemsRes.status === "fulfilled" && itemsRes.value.error) {
        console.error("Order items fetch error:", itemsRes.value.error);
      }
      const ratingsData =
        ratingsRes.status === "fulfilled" ? ratingsRes.value.data : null;
      if (ratingsRes.status === "fulfilled" && ratingsRes.value.error) {
        console.error("Delivery ratings fetch error:", ratingsRes.value.error);
      }
      const returnsData =
        returnsRes.status === "fulfilled" ? returnsRes.value.data : null;
      if (returnsRes.status === "fulfilled" && returnsRes.value.error) {
        console.error("Returns fetch error:", returnsRes.value.error);
      }

      const orderItemsMap = new Map<string, OrderItem[]>();
      (orderItemsData as OrderItemRecord[] | null)?.forEach((item) => {
        const currentItems = orderItemsMap.get(item.order_id) || [];

        currentItems.push({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          product: {
            name: item.product?.name || "منتج غير متوفر",
            image_url: item.product?.image_url || "/placeholder.svg",
          },
        });

        orderItemsMap.set(item.order_id, currentItems);
      });

      const ratingsMap = new Map(ratingsData?.map((rating) => [rating.order_id, rating]) || []);
      const returnsMap = new Map<string, ReturnData>();
      (returnsData as ReturnData[] | null)?.forEach((r) => {
        // Most recent per order (already sorted desc)
        if (!returnsMap.has(r.order_id)) returnsMap.set(r.order_id, r);
      });

      const ordersWithDetails: Order[] = (ordersData as OrderRecord[]).map((order) => ({
        id: order.id,
        created_at: order.created_at,
        total_amount: order.total_amount,
        status: order.status || "pending",
        delivered_at: order.delivered_at,
        order_items: orderItemsMap.get(order.id) || [],
        delivery_rating: ratingsMap.get(order.id) || null,
        return: returnsMap.get(order.id) || null,
      }));

      setOrders(ordersWithDetails);
    } catch (error) {
      console.error("Orders fetch error:", error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  // Realtime: refresh when this customer's orders are updated by a vendor/admin
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`orders-customer-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `customer_id=eq.${user.id}` },
        () => { void fetchOrders(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "returns", filter: `customer_id=eq.${user.id}` },
        () => { void fetchOrders(); }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchOrders]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "قيد المعالجة", variant: "secondary" },
      confirmed: { label: "مؤكد", variant: "default" },
      processing: { label: "قيد التحضير", variant: "secondary" },
      shipped: { label: "تم الشحن", variant: "outline" },
      out_for_delivery: { label: "في الطريق للتوصيل", variant: "outline" },
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
      <main className="flex-1 container px-4 py-6 sm:py-8">
        <h1 className="mb-8 text-2xl font-bold sm:text-3xl">طلباتي</h1>

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
                  <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        رقم الطلب: <span className="font-mono">{order.id.slice(0, 8)}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        التاريخ: {format(new Date(order.created_at), "dd MMMM yyyy", { locale: ar })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(order.status)}
                        {order.return && (
                          <Badge variant={RETURN_STATUS[order.return.status]?.variant || "outline"}>
                            إرجاع: {RETURN_STATUS[order.return.status]?.label || order.return.status}
                          </Badge>
                        )}
                        <p className="text-lg font-bold text-primary">
                          {order.total_amount.toLocaleString()} ل.س
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => navigate(`/orders/track/${order.id}`)}
                        >
                          تتبع الطلب
                        </Button>
                        {user && (
                          <ReorderButton
                            orderId={order.id}
                            userId={user.id}
                            orderItems={order.order_items.map(item => ({
                              product_id: item.product_id,
                              quantity: item.quantity
                            }))}
                          />
                        )}
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => navigate(`/orders/${order.id}`)}
                        >
                          عرض التفاصيل
                        </Button>
                        {user && (
                          <DeliveryRating
                            orderId={order.id}
                            userId={user.id}
                            isDelivered={order.status === "delivered"}
                            existingRating={order.delivery_rating?.rating}
                            onRatingSubmitted={() => void fetchOrders()}
                          />
                        )}
                        <CancelOrderDialog
                          orderId={order.id}
                          status={order.status}
                          fullWidth
                          onCancelled={() => void fetchOrders()}
                        />
                        <ReturnRequestDialog
                          order={{ id: order.id, status: order.status, delivered_at: order.delivered_at }}
                          fullWidth
                          onCreated={() => void fetchOrders()}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {order.order_items.map((item, index) => (
                      <div key={index} className="flex items-center gap-4 rounded-lg bg-muted/30 p-3">
                        <img
                          src={item.product?.image_url || "/placeholder.svg"}
                          alt={item.product?.name || "منتج"}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold">{item.product?.name || "منتج غير متوفر"}</h4>
                          <p className="text-sm text-muted-foreground">
                            الكمية: {item.quantity} × {item.price} ل.س
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
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Package, Search, ChevronRight, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import DeliveryRating from "@/components/DeliveryRating";
import ReorderButton from "@/components/ReorderButton";
import CancelOrderDialog from "@/components/CancelOrderDialog";
import ReturnRequestDialog from "@/components/ReturnRequestDialog";
import { RETURN_STATUS } from "@/lib/returnStatus";
import CustomerInvoice from "@/components/orders/CustomerInvoice";
import { normalizeStatus } from "@/lib/orderStatus";

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "تم التأكيد",
  preparing: "قيد التجهيز",
  ready_for_shipping: "جاهز للشحن",
  shipped: "تم الشحن",
  out_for_delivery: "خارج للتوصيل",
  delivered: "تم التوصيل",
  completed: "مكتمل",
  cancelled: "ملغي",
  return_requested: "طلب إرجاع",
  returning: "قيد الإرجاع",
  returned: "مرتجع",
  refunded: "تم رد المبلغ",
};

const STATUS_FILTERS = [
  { value: "all", label: "كل الحالات" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  confirmed: "default",
  preparing: "secondary",
  ready_for_shipping: "outline",
  shipped: "outline",
  out_for_delivery: "outline",
  delivered: "default",
  completed: "default",
  cancelled: "destructive",
  return_requested: "outline",
  returning: "outline",
  returned: "outline",
  refunded: "outline",
};

interface OrderItem {
  product_id: string;
  variant_label: string | null;
  product_name: string | null;
  product_image: string | null;
  product: {
    name: string;
    image_url: string;
  } | null;
  quantity: number;
  price: number;
}

interface OrderRecord {
  id: string;
  order_number: string | null;
  created_at: string;
  total_amount: number;
  status: string | null;
  tracking_status: string | null;
  delivered_at: string | null;
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
  order_number: string | null;
  created_at: string;
  total_amount: number;
  status: string;
  tracking_status: string | null;
  delivered_at: string | null;
  order_items: OrderItem[];
  delivery_rating?: DeliveryRatingData | null;
  return?: ReturnData | null;
}

const displayOrderNumber = (order: { order_number: string | null; id: string }) =>
  order.order_number || `#${order.id.slice(0, 8).toUpperCase()}`;

const Orders = () => {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  const fetchOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let matchingOrderIds: string[] | null = null;

      if (search) {
        const { data: matchByItem } = await supabase
          .from("order_items")
          .select("order_id, orders!inner(customer_id)")
          .eq("orders.customer_id", user.id)
          .ilike("product_name", `%${search}%`);
        const idsFromItems = (matchByItem || []).map((r: any) => r.order_id);
        matchingOrderIds = Array.from(new Set(idsFromItems));
      }

      let query = supabase
        .from("orders")
        .select("id, order_number, created_at, total_amount, status, tracking_status, delivered_at", { count: "exact" })
        .eq("customer_id", user.id);

      if (statusFilter !== "all") {
        if (statusFilter === "preparing") {
          query = query.in("status", ["preparing", "processing"]);
        } else {
          query = query.eq("status", statusFilter);
        }
      }

      if (search) {
        const orFilters = [`order_number.ilike.%${search}%`];
        if (matchingOrderIds && matchingOrderIds.length > 0) {
          orFilters.push(`id.in.(${matchingOrderIds.join(",")})`);
        }
        query = query.or(orFilters.join(","));
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data: ordersData, error: ordersError, count } = await query;

      if (ordersError) {
        console.error("Orders fetch error:", ordersError);
        setOrders([]);
        setTotalCount(0);
        return;
      }

      setTotalCount(count ?? 0);

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
            variant_label,
            product_name,
            product_image,
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
      (orderItemsData as any[] | null)?.forEach((item) => {
        const currentItems = orderItemsMap.get(item.order_id) || [];

        currentItems.push({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          variant_label: item.variant_label ?? null,
          product_name: item.product_name ?? null,
          product_image: item.product_image ?? null,
          product: {
            name: item.product_name || item.product?.name || "منتج غير متوفر",
            image_url: item.product_image || item.product?.image_url || "/placeholder.svg",
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
        order_number: order.order_number,
        created_at: order.created_at,
        total_amount: order.total_amount,
        status: order.status || "pending",
        tracking_status: order.tracking_status ?? null,
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
  }, [user, toast, statusFilter, search, page]);

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
    const key = normalizeStatus(status);
    const label = STATUS_LABELS[status] || STATUS_LABELS[key] || status;
    const variant = STATUS_VARIANTS[status] || STATUS_VARIANTS[key] || "secondary";
    return <Badge variant={variant}>{label}</Badge>;
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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
        <h1 className="mb-6 text-2xl font-bold sm:text-3xl">طلباتي</h1>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ابحث برقم الطلب أو اسم المنتج..."
              className="pr-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="كل الحالات" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
          <>
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-6">
                    <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          رقم الطلب: <span className="font-mono">{displayOrderNumber(order)}</span>
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
                            trackingStatus={order.tracking_status}
                            fullWidth
                            onCancelled={() => void fetchOrders()}
                          />
                          <ReturnRequestDialog
                            order={{ id: order.id, status: order.status, delivered_at: order.delivered_at }}
                            fullWidth
                            onCreated={() => void fetchOrders()}
                          />
                          {order.status !== "cancelled" && (
                            <CustomerInvoice orderId={order.id} />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {order.order_items.map((item, index) => (
                        <div key={index} className="flex items-center gap-4 rounded-lg bg-muted/30 p-3">
                          <img
                            src={item.product?.image_url || "/placeholder.svg"}
                            alt={item.product?.name || "منتج"}
                            loading="lazy"
                            decoding="async"
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold">{item.product?.name || "منتج غير متوفر"}</h4>
                            {item.variant_label && (
                              <p className="text-xs text-muted-foreground">{item.variant_label}</p>
                            )}
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

            {totalCount > PAGE_SIZE && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronRight className="h-4 w-4 ml-1" /> السابق
                </Button>
                <span className="text-sm text-muted-foreground">
                  صفحة {page + 1} من {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  التالي <ChevronLeft className="h-4 w-4 mr-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Orders;

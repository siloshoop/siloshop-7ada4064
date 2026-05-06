import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Package, MapPin, Clock, Truck, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// روابط تتبع شركات الشحن
const courierTrackingUrls: Record<string, (trackingNumber: string) => string> = {
  'aramex': (tn) => `https://www.aramex.com/track/results?ShipmentNumber=${tn}`,
  'أرامكس': (tn) => `https://www.aramex.com/track/results?ShipmentNumber=${tn}`,
  'dhl': (tn) => `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${tn}`,
  'دي اتش ال': (tn) => `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${tn}`,
  'fedex': (tn) => `https://www.fedex.com/fedextrack/?trknbr=${tn}`,
  'فيديكس': (tn) => `https://www.fedex.com/fedextrack/?trknbr=${tn}`,
  'ups': (tn) => `https://www.ups.com/track?tracknum=${tn}`,
  'يو بي اس': (tn) => `https://www.ups.com/track?tracknum=${tn}`,
  'smsa': (tn) => `https://www.smsaexpress.com/trackshipment?tracknumbers=${tn}`,
  'سمسا': (tn) => `https://www.smsaexpress.com/trackshipment?tracknumbers=${tn}`,
  'zajil': (tn) => `https://www.zajil.com/track?id=${tn}`,
  'زاجل': (tn) => `https://www.zajil.com/track?id=${tn}`,
  'saudi post': (tn) => `https://www.splonline.com.sa/track/${tn}`,
  'البريد السعودي': (tn) => `https://www.splonline.com.sa/track/${tn}`,
  'j&t': (tn) => `https://www.jtexpress.sa/track?id=${tn}`,
  'جي اند تي': (tn) => `https://www.jtexpress.sa/track?id=${tn}`,
  'naqel': (tn) => `https://naqelexpress.com/en/track/${tn}`,
  'ناقل': (tn) => `https://naqelexpress.com/en/track/${tn}`,
};

const getTrackingUrl = (courierName: string | null, trackingNumber: string): string | null => {
  if (!courierName || !trackingNumber) return null;
  const normalizedName = courierName.toLowerCase().trim();
  const urlGenerator = courierTrackingUrls[normalizedName];
  return urlGenerator ? urlGenerator(trackingNumber) : null;
};

interface Order {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  tracking_status: string;
  tracking_number: string | null;
  courier_name: string | null;
  estimated_delivery: string | null;
  shipping_address: string | null;
  current_location_lat: number | null;
  current_location_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  order_items: {
    quantity: number;
    price: number;
    products: {
      name: string;
      image_url: string;
    };
  }[];
}

interface StatusUpdate {
  status: string;
  location_lat: number | null;
  location_lng: number | null;
  notes: string | null;
  created_at: string;
}

const TrackOrder = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchOrder();
    fetchStatusHistory();

    // Subscribe to status updates
    const channel = supabase
      .channel('order-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_status_history',
          filter: `order_id=eq.${id}`
        },
        () => {
          fetchOrder();
          fetchStatusHistory();
        }
      )
      .subscribe();

    // Auto-refresh polling every 30s as fallback to realtime
    const pollInterval = setInterval(() => {
      fetchOrder();
      fetchStatusHistory();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [id, user]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !order || map.current) return;

    const initMap = async () => {
      try {
        // Fetch Mapbox token from edge function
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) throw error;
        
        const MAPBOX_TOKEN = data.token;
        
        mapboxgl.accessToken = MAPBOX_TOKEN;

        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [
            order.current_location_lng || 46.6753,
            order.current_location_lat || 24.7136
          ],
          zoom: 12
        });

        map.current.addControl(new mapboxgl.NavigationControl());

        // Add delivery location marker
        if (order.delivery_lat && order.delivery_lng) {
          new mapboxgl.Marker({ color: '#22c55e' })
            .setLngLat([order.delivery_lng, order.delivery_lat])
            .setPopup(new mapboxgl.Popup().setHTML('<p>وجهة التسليم</p>'))
            .addTo(map.current);
        }

        // Add current location marker
        if (order.current_location_lat && order.current_location_lng) {
          new mapboxgl.Marker({ color: '#3b82f6' })
            .setLngLat([order.current_location_lng, order.current_location_lat])
            .setPopup(new mapboxgl.Popup().setHTML('<p>الموقع الحالي</p>'))
            .addTo(map.current);
        }
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();

    return () => {
      map.current?.remove();
    };
  }, [order]);

  const fetchOrder = async () => {
    if (!user || !id) return;

    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items(
          quantity,
          price,
          products(name, image_url)
        )
      `)
      .eq("id", id)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (error) {
      console.error(error);
      return;
    }

    setOrder(data as any);
    setLoading(false);
  };

  const fetchStatusHistory = async () => {
    if (!id) return;

    const { data } = await supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: false });

    if (data) {
      setStatusHistory(data);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'out_for_delivery':
        return 'bg-orange-100 text-orange-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'قيد الانتظار';
      case 'processing':
        return 'قيد المعالجة';
      case 'shipped':
        return 'تم الشحن';
      case 'out_for_delivery':
        return 'في الطريق للتوصيل';
      case 'delivered':
        return 'تم التسليم';
      case 'cancelled':
        return 'ملغي';
      default:
        return status;
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

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">الطلب غير موجود</h2>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">تتبع الطلب</h1>
            <p className="text-muted-foreground">رقم الطلب: {order.id.slice(0, 8)}</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Order Details */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>تفاصيل الطلب</span>
                    <Badge className={getStatusColor(order.tracking_status)}>
                      {getStatusText(order.tracking_status)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">تاريخ الطلب:</span>
                    <span className="font-medium">
                      {format(new Date(order.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
                    </span>
                  </div>

                  {order.tracking_number && (
                    <div className="flex items-center gap-3 text-sm">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">رقم التتبع:</span>
                      <span className="font-medium font-mono">{order.tracking_number}</span>
                    </div>
                  )}

                  {order.courier_name && (
                    <div className="flex items-center gap-3 text-sm">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">شركة الشحن:</span>
                      <span className="font-medium">{order.courier_name}</span>
                    </div>
                  )}

                  {/* زر تتبع الشحنة المباشر */}
                  {order.tracking_number && order.courier_name && (
                    <div className="pt-2">
                      {getTrackingUrl(order.courier_name, order.tracking_number) ? (
                        <Button
                          className="w-full"
                          onClick={() => {
                            const url = getTrackingUrl(order.courier_name, order.tracking_number!);
                            if (url) window.open(url, '_blank');
                          }}
                        >
                          <ExternalLink className="h-4 w-4 ml-2" />
                          تتبع الشحنة عبر {order.courier_name}
                        </Button>
                      ) : (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground text-center">
                            يمكنك تتبع شحنتك باستخدام رقم التتبع: <span className="font-mono font-bold">{order.tracking_number}</span>
                          </p>
                          <p className="text-xs text-muted-foreground text-center mt-1">
                            عبر موقع شركة الشحن: {order.courier_name}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {order.estimated_delivery && (
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">التسليم المتوقع:</span>
                      <span className="font-medium">
                        {format(new Date(order.estimated_delivery), "dd MMM yyyy", { locale: ar })}
                      </span>
                    </div>
                  )}

                  {order.shipping_address && (
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <span className="text-muted-foreground">عنوان التسليم:</span>
                        <p className="font-medium mt-1">{order.shipping_address}</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <div className="flex justify-between text-lg font-bold">
                      <span>المجموع:</span>
                      <span className="text-primary">{order.total_amount} ل.س</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status History */}
              <Card>
                <CardHeader>
                  <CardTitle>سجل التتبع</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusHistory.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      لا توجد تحديثات بعد
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {statusHistory.map((update, index) => (
                        <div key={index} className="flex gap-4 pb-4 border-b last:border-0">
                          <div className="flex flex-col items-center">
                            <div className="h-3 w-3 rounded-full bg-primary" />
                            {index < statusHistory.length - 1 && (
                              <div className="w-px h-full bg-border mt-2" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <Badge className={getStatusColor(update.status)} variant="outline">
                              {getStatusText(update.status)}
                            </Badge>
                            {update.notes && (
                              <p className="text-sm mt-2">{update.notes}</p>
                            )}
                            <span className="text-xs text-muted-foreground mt-1 block">
                              {format(new Date(update.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Map */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>موقع التتبع</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    ref={mapContainer}
                    className="w-full h-96 rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    📍 الأخضر: وجهة التسليم | 🔵 الأزرق: الموقع الحالي
                  </p>
                </CardContent>
              </Card>

              {/* Order Items */}
              <Card>
                <CardHeader>
                  <CardTitle>المنتجات</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {order.order_items.map((item, index) => (
                      <div key={index} className="flex gap-4">
                        <img
                          src={item.products.image_url}
                          alt={item.products.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium">{item.products.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            الكمية: {item.quantity} × {item.price} ل.س
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TrackOrder;

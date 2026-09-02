import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, Search, Trash2, Filter, X, CheckCheck, Package, Tag, Info,
  AlertTriangle, Settings, Percent, Store, ShieldCheck, ShieldAlert,
  UserCheck, UserX, Truck, RotateCcw, MessageSquare, Star, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Loader2 } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  related_id: string | null;
}

const BLUE = "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
const GREEN = "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
const RED = "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
const ORANGE = "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300";
const PURPLE = "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
const GRAY = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
const YELLOW = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";

const NotificationTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  // Orders & shipments
  order: { label: "طلب جديد", icon: <Package className="h-4 w-4" />, color: BLUE },
  order_status: { label: "حالة الطلب", icon: <Truck className="h-4 w-4" />, color: GREEN },
  order_cancelled: { label: "إلغاء طلب", icon: <Ban className="h-4 w-4" />, color: RED },
  // Seller lifecycle
  seller_approved: { label: "اعتماد بائع", icon: <ShieldCheck className="h-4 w-4" />, color: GREEN },
  seller_rejected: { label: "رفض طلب بائع", icon: <ShieldAlert className="h-4 w-4" />, color: RED },
  seller_suspended: { label: "إيقاف بائع", icon: <ShieldAlert className="h-4 w-4" />, color: YELLOW },
  seller_reactivated: { label: "إعادة تفعيل بائع", icon: <ShieldCheck className="h-4 w-4" />, color: GREEN },
  // Product moderation
  product_approve: { label: "اعتماد منتج", icon: <ShieldCheck className="h-4 w-4" />, color: GREEN },
  product_reject: { label: "رفض منتج", icon: <ShieldAlert className="h-4 w-4" />, color: RED },
  product_hide: { label: "إخفاء منتج", icon: <ShieldAlert className="h-4 w-4" />, color: YELLOW },
  product_restore: { label: "استعادة منتج", icon: <ShieldCheck className="h-4 w-4" />, color: GREEN },
  product_suspend: { label: "تعليق منتج", icon: <ShieldAlert className="h-4 w-4" />, color: YELLOW },
  product_deleted: { label: "حذف منتج", icon: <Trash2 className="h-4 w-4" />, color: RED },
  // Account lifecycle
  account_activated: { label: "تفعيل حساب", icon: <UserCheck className="h-4 w-4" />, color: GREEN },
  account_suspended: { label: "إيقاف حساب", icon: <UserX className="h-4 w-4" />, color: YELLOW },
  account_banned: { label: "حظر حساب", icon: <Ban className="h-4 w-4" />, color: RED },
  // Catalog / promos
  price_change: { label: "تغيير سعر", icon: <Tag className="h-4 w-4" />, color: ORANGE },
  price_drop: { label: "تخفيض سعر", icon: <Percent className="h-4 w-4" />, color: GREEN },
  daily_deal: { label: "عرض يومي", icon: <Tag className="h-4 w-4" />, color: ORANGE },
  deal: { label: "عرض", icon: <Tag className="h-4 w-4" />, color: ORANGE },
  deal_ended: { label: "انتهاء عرض", icon: <Tag className="h-4 w-4" />, color: GRAY },
  new_product: { label: "منتج جديد", icon: <Store className="h-4 w-4" />, color: PURPLE },
  push_new_product: { label: "منتج جديد", icon: <Store className="h-4 w-4" />, color: PURPLE },
  // Reviews & chat
  rating: { label: "تقييم", icon: <Star className="h-4 w-4" />, color: YELLOW },
  review_reply: { label: "رد على تقييم", icon: <MessageSquare className="h-4 w-4" />, color: BLUE },
  report_update: { label: "تحديث بلاغ", icon: <Info className="h-4 w-4" />, color: BLUE },
  // Fallbacks
  warning: { label: "تحذير", icon: <AlertTriangle className="h-4 w-4" />, color: RED },
  info: { label: "معلومات", icon: <Info className="h-4 w-4" />, color: GRAY },
};

const Notifications = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channel = supabase
      .channel('notifications-page-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          toast({
            title: newNotification.title,
            description: newNotification.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  const fetchNotifications = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setNotifications(data);
    }
    setLoading(false);
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = !searchQuery || 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === "all" || n.type === typeFilter;
    
    const matchesRead = readFilter === "all" || 
      (readFilter === "unread" && !n.is_read) ||
      (readFilter === "read" && n.is_read);

    return matchesSearch && matchesType && matchesRead;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const uniqueTypes = [...new Set(notifications.map(n => n.type))];

  const markAsRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  };

  const markAllAsRead = async () => {
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    toast({
      title: "تم التحديث",
      description: "تم تحديد جميع الإشعارات كمقروءة",
    });
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast({
        title: "تم الحذف",
        description: "تم حذف الإشعار بنجاح",
      });
    }
  };

  const deleteAllRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id)
      .eq("is_read", true);

    if (!error) {
      setNotifications(prev => prev.filter(n => !n.is_read));
      toast({
        title: "تم الحذف",
        description: "تم حذف جميع الإشعارات المقروءة",
      });
    }
  };

  const getTypeConfig = (type: string) => {
    return NotificationTypeConfig[type] || NotificationTypeConfig.info;
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) markAsRead(notification.id);

    const { type, related_id } = notification;

    // Types that don't need related_id
    if (type === "seller_approved" || type === "seller_reactivated") {
      navigate("/dashboard");
      return;
    }
    if (type === "seller_rejected" || type === "seller_suspended") {
      navigate("/seller/application");
      return;
    }
    if (type === "account_activated" || type === "account_suspended" || type === "account_banned") {
      navigate("/profile");
      return;
    }

    if (!related_id) return;

    if (
      type === "order" || type === "order_status" ||
      type === "order_cancelled" || type === "order_refunded"
    ) {
      navigate(`/orders/track/${related_id}`);
      return;
    }
    if (type === "return_status") {
      navigate(related_id ? `/orders/track/${related_id}` : "/orders");
      return;

    }
    if (type.startsWith("product_") && type !== "product_deleted") {
      navigate(`/product/${related_id}`);
      return;
    }
    if (
      type === "price_change" || type === "price_drop" ||
      type === "daily_deal" || type === "deal" || type === "deal_ended" ||
      type === "new_product" || type === "push_new_product"
    ) {
      navigate(`/product/${related_id}`);
      return;
    }
    if (type === "rating" || type === "review_reply") {
      navigate(`/product/${related_id}`);
      return;
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

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">الإشعارات</h1>
              <p className="text-muted-foreground">
                {unreadCount > 0 ? `لديك ${unreadCount} إشعار غير مقروء` : "لا توجد إشعارات جديدة"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/notifications/settings")}>
              <Settings className="h-4 w-4 ml-2" />
              إعدادات الإشعارات
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={markAllAsRead}>
                <CheckCheck className="h-4 w-4 ml-2" />
                تحديد الكل كمقروء
              </Button>
            )}
            {notifications.some(n => n.is_read) && (
              <Button variant="outline" onClick={deleteAllRead}>
                <Trash2 className="h-4 w-4 ml-2" />
                حذف المقروءة
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث في الإشعارات..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 ml-2" />
                  <SelectValue placeholder="نوع الإشعار" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  {uniqueTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {getTypeConfig(type).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Tabs value={readFilter} onValueChange={setReadFilter}>
                <TabsList>
                  <TabsTrigger value="all">الكل</TabsTrigger>
                  <TabsTrigger value="unread">
                    غير مقروء
                    {unreadCount > 0 && (
                      <Badge className="mr-2" variant="secondary">{unreadCount}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="read">مقروء</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">
                {searchQuery || typeFilter !== "all" || readFilter !== "all"
                  ? "لا توجد نتائج مطابقة للبحث"
                  : "لا توجد إشعارات"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => {
              const config = getTypeConfig(notification.type);
              return (
                <Card
                  key={notification.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    !notification.is_read ? "border-primary/50 bg-primary/5" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-full ${config.color}`}>
                        {config.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{notification.title}</h3>
                          {!notification.is_read && (
                            <div className="h-2 w-2 bg-primary rounded-full" />
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm mb-2">
                          {notification.message}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Notifications;

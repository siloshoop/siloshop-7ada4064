import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Search, Trash2, Filter, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  related_id: string | null;
}

export const NotificationsDropdown = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel('notifications-channel')
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
          setNotifications(prev => [newNotification, ...prev.slice(0, 49)]);
          setUnreadCount(prev => prev + 1);
          
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

  // Filter notifications based on search and type
  useEffect(() => {
    let filtered = notifications;

    if (searchQuery) {
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.message.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter(n => n.type === typeFilter);
    }

    setFilteredNotifications(filtered);
  }, [notifications, searchQuery, typeFilter]);

  const markAsRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (!error) {
      const notification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      toast({
        title: "تم الحذف",
        description: "تم حذف الإشعار بنجاح",
      });
    }
  };

  const deleteOldNotifications = async () => {
    if (!user) return;
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id)
      .lt("created_at", weekAgo.toISOString());

    if (!error) {
      setNotifications(prev => 
        prev.filter(n => new Date(n.created_at) > weekAgo)
      );
      toast({
        title: "تم الحذف",
        description: "تم حذف الإشعارات القديمة بنجاح",
      });
    }
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      order: "طلب جديد",
      order_status: "حالة الطلب",
      order_cancelled: "إلغاء طلب",
      order_refunded: "استرداد مبلغ",
      return_status: "حالة إرجاع",
      seller_approved: "اعتماد بائع",
      seller_rejected: "رفض طلب بائع",
      seller_suspended: "إيقاف بائع",
      seller_reactivated: "إعادة تفعيل بائع",
      product_approve: "اعتماد منتج",
      product_reject: "رفض منتج",
      product_hide: "إخفاء منتج",
      product_restore: "استعادة منتج",
      product_suspend: "تعليق منتج",
      product_deleted: "حذف منتج",
      account_activated: "تفعيل حساب",
      account_suspended: "إيقاف حساب",
      account_banned: "حظر حساب",
      price_change: "تغيير سعر",
      price_drop: "تخفيض سعر",
      daily_deal: "عرض يومي",
      deal: "عرض",
      deal_ended: "انتهاء عرض",
      new_product: "منتج جديد",
      push_new_product: "منتج جديد",
      rating: "تقييم",
      review_reply: "رد على تقييم",
      report_update: "تحديث بلاغ",
      warning: "تحذير",
      info: "معلومات",
    };
    return types[type] || type;
  };

  const uniqueTypes = [...new Set(notifications.map(n => n.type))];

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -left-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="p-2 border-b space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold">الإشعارات</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  تحديد الكل كمقروء
                </Button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في الإشعارات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-8 h-9"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-1 top-1 h-7 w-7"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue placeholder="نوع الإشعار" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأنواع</SelectItem>
                    {uniqueTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {getTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deleteOldNotifications}
                  className="h-9 text-xs whitespace-nowrap"
                >
                  <Trash2 className="h-3 w-3 ml-1" />
                  حذف القديمة
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {searchQuery || typeFilter !== "all" 
                ? "لا توجد نتائج مطابقة" 
                : "لا توجد إشعارات"}
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex flex-col items-start p-3 cursor-pointer group"
                onClick={() => !notification.is_read && markAsRead(notification.id)}
              >
                <div className="flex items-start justify-between w-full gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {notification.title}
                      </span>
                      {!notification.is_read && (
                        <div className="h-2 w-2 bg-primary rounded-full" />
                      )}
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {getTypeLabel(notification.type)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.message}
                    </p>
                    <span className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: ar,
                      })}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => deleteNotification(notification.id, e)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
        
        {notifications.length > 0 && (
          <div className="p-2 border-t flex gap-2">
            <Button 
              variant="ghost" 
              className="flex-1 text-sm"
              onClick={() => navigate("/notifications")}
            >
              عرض جميع الإشعارات
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9"
              onClick={() => navigate("/notifications/settings")}
              title="إعدادات الإشعارات"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {notifications.length === 0 && (
          <div className="p-2 border-t">
            <Button 
              variant="ghost" 
              className="w-full text-sm"
              onClick={() => navigate("/notifications/settings")}
            >
              <Settings className="h-4 w-4 ml-2" />
              إعدادات الإشعارات
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
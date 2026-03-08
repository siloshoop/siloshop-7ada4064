import { useEffect, useState } from "react";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Activity, 
  Search, 
  LogIn, 
  LogOut, 
  UserPlus, 
  ShoppingCart, 
  Package, 
  UserCog,
  Ban,
  UserCheck,
  Shield,
  ShieldX,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  action_details: Record<string, any>;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
  profiles?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

const ActivityLogs = () => {
  const { user, isAdmin, loading: adminLoading } = useAdminCheck();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [isAdmin]);

  const fetchLogs = async () => {
    try {
      // Fetch activity logs
      const { data: logsData, error: logsError } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (logsError) throw logsError;

      // Get unique user IDs
      const userIds = [...new Set(logsData?.map(log => log.user_id) || [])];
      
      // Fetch profiles for those users
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      // Map profiles to logs
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      const logsWithProfiles = (logsData || []).map(log => ({
        ...log,
        action_details: (log.action_details || {}) as Record<string, any>,
        profiles: profilesMap.get(log.user_id) || null,
      }));

      setLogs(logsWithProfiles);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "login":
        return <LogIn className="h-4 w-4 text-green-500" />;
      case "logout":
        return <LogOut className="h-4 w-4 text-gray-500" />;
      case "signup":
        return <UserPlus className="h-4 w-4 text-blue-500" />;
      case "order_created":
      case "order_updated":
        return <ShoppingCart className="h-4 w-4 text-purple-500" />;
      case "product_created":
      case "product_updated":
      case "product_deleted":
        return <Package className="h-4 w-4 text-orange-500" />;
      case "profile_updated":
        return <UserCog className="h-4 w-4 text-cyan-500" />;
      case "user_banned":
        return <Ban className="h-4 w-4 text-red-500" />;
      case "user_unbanned":
        return <UserCheck className="h-4 w-4 text-green-500" />;
      case "role_added":
        return <Shield className="h-4 w-4 text-yellow-500" />;
      case "role_removed":
        return <ShieldX className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      login: "تسجيل دخول",
      logout: "تسجيل خروج",
      signup: "إنشاء حساب",
      order_created: "إنشاء طلب",
      order_updated: "تحديث طلب",
      product_created: "إضافة منتج",
      product_updated: "تحديث منتج",
      product_deleted: "حذف منتج",
      profile_updated: "تحديث الملف الشخصي",
      user_banned: "حظر مستخدم",
      user_unbanned: "إلغاء حظر مستخدم",
      role_added: "إضافة صلاحية",
      role_removed: "إزالة صلاحية",
    };
    return labels[actionType] || actionType;
  };

  const getActionBadgeVariant = (actionType: string) => {
    if (actionType.includes("banned") || actionType.includes("deleted") || actionType.includes("removed")) {
      return "destructive";
    }
    if (actionType.includes("created") || actionType.includes("added") || actionType === "signup") {
      return "default";
    }
    return "secondary";
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action_type.includes(searchQuery.toLowerCase());

    const matchesAction =
      filterAction === "all" || log.action_type === filterAction;

    return matchesSearch && matchesAction;
  });

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

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">سجل النشاطات</h1>
              </div>
              <p className="text-muted-foreground">
                عرض جميع أنشطة المستخدمين ({logs.length} نشاط)
              </p>
            </div>
            <Button variant="outline" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم أو نوع النشاط..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger className="w-full md:w-56">
                    <SelectValue placeholder="فلترة حسب النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأنشطة</SelectItem>
                    <SelectItem value="login">تسجيل الدخول</SelectItem>
                    <SelectItem value="logout">تسجيل الخروج</SelectItem>
                    <SelectItem value="signup">إنشاء حساب</SelectItem>
                    <SelectItem value="order_created">إنشاء طلب</SelectItem>
                    <SelectItem value="product_created">إضافة منتج</SelectItem>
                    <SelectItem value="user_banned">حظر مستخدم</SelectItem>
                    <SelectItem value="user_unbanned">إلغاء حظر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {filteredLogs.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Activity className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground">لا توجد نشاطات مطابقة للبحث</p>
                </CardContent>
              </Card>
            ) : (
              filteredLogs.map((log) => (
                <Card key={log.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={log.profiles?.avatar_url || undefined} />
                        <AvatarFallback>
                          {log.profiles?.full_name?.[0]?.toUpperCase() || "؟"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            {log.profiles?.full_name || "مستخدم غير معروف"}
                          </span>
                          <Badge variant={getActionBadgeVariant(log.action_type) as any} className="flex items-center gap-1">
                            {getActionIcon(log.action_type)}
                            {getActionLabel(log.action_type)}
                          </Badge>
                        </div>
                        {Object.keys(log.action_details).length > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {JSON.stringify(log.action_details)}
                          </p>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground text-left">
                        {format(new Date(log.created_at), "dd MMM yyyy", { locale: ar })}
                        <br />
                        <span className="text-xs">
                          {format(new Date(log.created_at), "HH:mm", { locale: ar })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ActivityLogs;

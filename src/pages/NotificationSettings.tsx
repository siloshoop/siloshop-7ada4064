import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bell, Package, Tag, Percent, Loader2, ShoppingBag, Mail, Megaphone } from "lucide-react";
import PushNotificationManager from "@/components/PushNotificationManager";

interface NotificationPreferences {
  new_products: boolean;
  daily_deals: boolean;
  price_drops: boolean;
  order_updates: boolean;
  promotions: boolean;
  newsletter: boolean;
}

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof NotificationPreferences | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    new_products: true,
    daily_deals: true,
    price_drops: true,
    order_updates: true,
    promotions: true,
    newsletter: false,
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);
      await fetchOrCreatePreferences(user.id);
    };
    checkAuth();
  }, [navigate]);

  const fetchOrCreatePreferences = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          new_products: data.new_products,
          daily_deals: data.daily_deals,
          price_drops: data.price_drops,
          order_updates: data.order_updates,
          promotions: data.promotions,
          newsletter: data.newsletter,
        });
      } else {
        // No prefs yet — create defaults
        const defaults = {
          new_products: true,
          daily_deals: true,
          price_drops: true,
          order_updates: true,
          promotions: true,
          newsletter: false,
        };
        const { error: insertError } = await supabase
          .from("notification_preferences")
          .insert({ user_id: uid, ...defaults });
        if (insertError && insertError.code !== "23505") throw insertError;
        setPreferences(defaults);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!userId) return;
    const previous = preferences[key];
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setSavingKey(key);
    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: userId,
            ...preferences,
            [key]: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    } catch (error) {
      console.error("Error saving preference:", error);
      setPreferences((prev) => ({ ...prev, [key]: previous }));
      toast({
        title: "خطأ",
        description: "تعذر حفظ التفضيل، حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  const notificationOptions = [
    {
      key: "order_updates" as keyof NotificationPreferences,
      icon: ShoppingBag,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
      title: "تحديثات الطلبات",
      description: "إشعارات عند تغيير حالة طلباتك (شحن، توصيل، إلخ)",
    },
    {
      key: "new_products" as keyof NotificationPreferences,
      icon: Package,
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
      title: "منتجات جديدة",
      description: "إشعارات عند إضافة منتجات جديدة من الماركات المتابَعة",
    },
    {
      key: "daily_deals" as keyof NotificationPreferences,
      icon: Tag,
      iconColor: "text-orange-500",
      bgColor: "bg-orange-500/10",
      title: "العروض اليومية",
      description: "إشعارات عند إضافة منتجاتك المفضلة للعروض اليومية",
    },
    {
      key: "price_drops" as keyof NotificationPreferences,
      icon: Percent,
      iconColor: "text-green-500",
      bgColor: "bg-green-500/10",
      title: "تخفيضات الأسعار",
      description: "إشعارات عند انخفاض أسعار المنتجات المفضلة لديك",
    },
    {
      key: "promotions" as keyof NotificationPreferences,
      icon: Megaphone,
      iconColor: "text-purple-500",
      bgColor: "bg-purple-500/10",
      title: "العروض الترويجية",
      description: "إشعارات بالعروض والخصومات الخاصة",
    },
    {
      key: "newsletter" as keyof NotificationPreferences,
      icon: Mail,
      iconColor: "text-rose-500",
      bgColor: "bg-rose-500/10",
      title: "النشرة البريدية",
      description: "استلم ملخص أسبوعي بأفضل العروض والمنتجات",
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">إعدادات الإشعارات</h1>
          </div>

          {/* Push Notifications Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                إشعارات المتصفح
              </CardTitle>
              <CardDescription>
                تلقي إشعارات فورية على متصفحك
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PushNotificationManager />
            </CardContent>
          </Card>

          {/* Notification Types Card */}
          <Card>
            <CardHeader>
              <CardTitle>أنواع الإشعارات</CardTitle>
              <CardDescription>
                اختر أنواع الإشعارات التي تريد تلقيها
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notificationOptions.map((option) => {
                const IconComponent = option.icon;
                return (
                  <div 
                    key={option.key}
                    className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className={`p-2 rounded-full shrink-0 ${option.bgColor}`}>
                        <IconComponent className={`h-5 w-5 ${option.iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <Label htmlFor={option.key} className="text-base font-medium cursor-pointer">
                          {option.title}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center">
                      {savingKey === option.key && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-2" />
                      )}
                      <Switch
                        id={option.key}
                        checked={preferences[option.key]}
                        onCheckedChange={(v) => handleToggle(option.key, v)}
                        disabled={savingKey !== null}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">ملاحظة</p>
                  <p>
                    لتلقي إشعارات المتصفح، تأكد من تفعيل خاصية "إشعارات المتصفح" أعلاه 
                    والسماح للموقع بإرسال الإشعارات من خلال إعدادات المتصفح.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotificationSettings;

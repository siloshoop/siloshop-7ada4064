import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getPushWorkerRegistration } from "@/lib/pushWorker";

interface PushNotificationManagerProps {
  variant?: "button" | "icon";
  className?: string;
}

const PushNotificationManager = ({
  variant = "button",
  className = "",
}: PushNotificationManagerProps) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (!user) {
        setLoading(false);
        return;
      }

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setLoading(false);
        return;
      }

      const registration = await getPushWorkerRegistration();
      if (!registration) return;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Check if subscription exists in database
        const { data } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint)
          .maybeSingle();

        setIsSubscribed(!!data);
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = async () => {
    if (!user) {
      toast({
        title: "تسجيل الدخول مطلوب",
        description: "يرجى تسجيل الدخول لتفعيل الإشعارات",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission !== "granted") {
        toast({
          title: "الإذن مرفوض",
          description: "يرجى السماح بالإشعارات من إعدادات المتصفح",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Get VAPID public key
      const { data: vapidData, error: vapidError } = await supabase.functions.invoke(
        "get-vapid-key"
      );

      if (vapidError || !vapidData?.publicKey) {
        throw new Error("Failed to get VAPID key");
      }

      const registration = await getPushWorkerRegistration();
      if (!registration) throw new Error("Push notifications are not supported");

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      const subscriptionJson = subscription.toJSON();

      // Save subscription to database
      const { error: saveError } = await supabase
        .from("push_subscriptions")
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint,
          p256dh: subscriptionJson.keys?.p256dh,
          auth: subscriptionJson.keys?.auth,
        }, {
          onConflict: "user_id,endpoint",
        });

      if (saveError) {
        throw saveError;
      }

      setIsSubscribed(true);
      toast({
        title: "تم تفعيل الإشعارات",
        description: "ستتلقى إشعارات عند وصول منتجات جديدة من الماركات المتابعة",
      });
    } catch (error) {
      console.error("Subscription error:", error);
      toast({
        title: "حدث خطأ",
        description: "فشل تفعيل الإشعارات. يرجى المحاولة مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const registration = await getPushWorkerRegistration();
      if (!registration) return;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }

      setIsSubscribed(false);
      toast({
        title: "تم إلغاء الإشعارات",
        description: "لن تتلقى إشعارات بعد الآن",
      });
    } catch (error) {
      console.error("Unsubscribe error:", error);
      toast({
        title: "حدث خطأ",
        description: "فشل إلغاء الإشعارات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if push notifications are supported
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={className}
        title={isSubscribed ? "إلغاء الإشعارات" : "تفعيل الإشعارات"}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="h-5 w-5 text-primary" />
        ) : (
          <BellOff className="h-5 w-5" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={isSubscribed ? "outline" : "default"}
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="h-4 w-4 ml-2 text-primary" />
      ) : (
        <BellOff className="h-4 w-4 ml-2" />
      )}
      {isSubscribed ? "إلغاء الإشعارات" : "تفعيل الإشعارات"}
    </Button>
  );
};

export default PushNotificationManager;
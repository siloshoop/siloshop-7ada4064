import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { disablePush, enablePush, pushStatus, pushStatusMessage, type PushStatus } from "@/lib/push";

interface PushNotificationManagerProps {
  variant?: "button" | "icon";
  className?: string;
}

/** Turns phone/browser alerts on or off for this device (orders, store requests, platform notices). */
const PushNotificationManager = ({ variant = "button", className = "" }: PushNotificationManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!user) { setStatus(null); return; }
    pushStatus().then((s) => alive && setStatus(s), () => alive && setStatus("unsupported"));
    return () => { alive = false; };
  }, [user]);

  if (!user || status === null) return null;
  // The icon hides where it can never work; the settings card explains why.
  if (status === "unsupported" || status === "not-configured") {
    if (variant === "icon") return null;
    return <p className="text-sm text-muted-foreground">{pushStatusMessage(status)?.description}</p>;
  }

  const on = status === "on";
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        setStatus("off");
        toast({ title: "تم إيقاف الإشعارات", description: "لن تصلك تنبيهات على هذا الجهاز" });
      } else {
        const { status: next } = await enablePush(true);
        setStatus(next === "on" || next === "denied" ? next : "off");
        const msg = pushStatusMessage(next);
        if (msg) toast({ ...msg, variant: next === "on" ? "default" : "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  const label = on ? "إيقاف الإشعارات" : "تفعيل الإشعارات";

  if (variant === "icon") {
    return (
      <Button variant="ghost" size="icon" onClick={toggle} disabled={busy} className={className} title={label} aria-label={label} aria-pressed={on}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : on ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5" />}
      </Button>
    );
  }

  return (
    <Button variant={on ? "outline" : "default"} onClick={toggle} disabled={busy} className={className} aria-pressed={on}>
      {busy ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : on ? <Bell className="h-4 w-4 ml-2 text-primary" /> : <BellOff className="h-4 w-4 ml-2" />}
      {label}
    </Button>
  );
};

export default PushNotificationManager;

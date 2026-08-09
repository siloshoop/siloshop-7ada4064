import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  fetchOrderTimeline, statusLabel, statusClasses, getStatusMeta,
  describeDevice, ACTOR_ROLE_LABELS, friendlyOrderError, type TimelineEntry,
} from "@/lib/orderStatus";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldAlert, Globe, Monitor } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  orderId: string;
  className?: string;
  /** live-refresh the log when new history rows arrive */
  realtime?: boolean;
}

/** Full audit trail of an order: status, actor, role, date, IP and device. */
const OrderTimelineLog = ({ orderId, className, realtime = true }: Props) => {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const rows = await fetchOrderTimeline(orderId);
        if (active) setEntries(rows);
      } catch (e) {
        if (active) setError(friendlyOrderError(e));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();

    if (!realtime) return () => { active = false; };

    const channel = supabase
      .channel(`order-timeline-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_status_history", filter: `order_id=eq.${orderId}` },
        () => { load(); },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [orderId, realtime]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6" dir="rtl">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error) return <p className="text-sm text-muted-foreground" dir="rtl">{error}</p>;
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground" dir="rtl">لا يوجد سجل تحديثات لهذا الطلب بعد.</p>;
  }

  return (
    <ol className={cn("relative space-y-4 pr-4", className)} dir="rtl">
      <span className="absolute right-[7px] top-2 bottom-2 w-px bg-border" aria-hidden />
      {entries.map((e) => {
        const meta = getStatusMeta(e.status);
        const c = statusClasses(e.status);
        const Icon = meta.icon;
        return (
          <li key={e.id} className="relative pr-6">
            <span className={cn("absolute right-0 top-1.5 h-4 w-4 rounded-full", c.bg)} aria-hidden />
            <div className="flex flex-wrap items-center gap-2">
              <Icon className={cn("h-4 w-4", c.text)} />
              <span className="font-semibold">{statusLabel(e.status)}</span>
              {e.from_status && (
                <span className="text-xs text-muted-foreground">
                  (من: {statusLabel(e.from_status)})
                </span>
              )}
              <Badge variant="outline" className="text-[10px]">
                {ACTOR_ROLE_LABELS[e.changed_by_role] || e.changed_by_role}
                {e.actor_name ? ` · ${e.actor_name}` : ""}
              </Badge>
              {e.is_override && (
                <Badge variant="destructive" className="text-[10px] gap-1">
                  <ShieldAlert className="h-3 w-3" /> تجاوز إداري
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(e.created_at).toLocaleString("ar-SY", {
                year: "numeric", month: "long", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
            {e.notes && <p className="mt-1 text-sm">{e.notes}</p>}
            {(e.ip_address || e.user_agent) && (
              <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                {e.ip_address && (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3 w-3" /> {e.ip_address}
                  </span>
                )}
                {e.user_agent && (
                  <span className="inline-flex items-center gap-1" title={e.user_agent}>
                    <Monitor className="h-3 w-3" /> {describeDevice(e.user_agent)}
                  </span>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default OrderTimelineLog;
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { returnStatusLabel } from "@/lib/returnStatus";
import { Loader2 } from "lucide-react";

interface HistoryRow {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by_role: string | null;
  note: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  customer: "المشتري",
  vendor: "البائع",
  admin: "الإدارة",
};

/** Full audit trail of a return request (visible to owner, seller and admins via RLS). */
const ReturnHistory = ({ returnId }: { returnId: string }) => {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("return_status_history")
        .select("id, from_status, to_status, changed_by_role, note, created_at")
        .eq("return_id", returnId)
        .order("created_at", { ascending: true });
      if (!alive) return;
      setRows((data as HistoryRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [returnId]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">لا يوجد سجل بعد</p>;

  return (
    <ul className="space-y-2 border-s ps-3" dir="rtl">
      {rows.map((h) => (
        <li key={h.id} className="text-xs">
          <span className="font-semibold">{returnStatusLabel(h.to_status)}</span>
          {h.changed_by_role && (
            <span className="text-muted-foreground">
              {" "}
              — {ROLE_LABELS[h.changed_by_role] ?? h.changed_by_role}
            </span>
          )}
          <span className="text-muted-foreground">
            {" "}
            · {format(new Date(h.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
          </span>
          {h.note && <p className="text-muted-foreground">{h.note}</p>}
        </li>
      ))}
    </ul>
  );
};

export default ReturnHistory;
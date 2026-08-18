import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, ScrollText } from "lucide-react";

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "مدير عام",
  admin: "مدير",
  moderator: "مشرف",
};

const ALL = "__all__";

const AdminAuditLog = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState(ALL);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (cancelled) return;
      const list = (data as AuditRow[]) ?? [];
      setRows(list);
      const ids = [...new Set(list.map((r) => r.actor_id).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles").select("id, full_name").in("id", ids);
        if (!cancelled) {
          setNames(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name || "بدون اسم"])));
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const targets = useMemo(
    () => [...new Set(rows.map((r) => r.target_type))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (target !== ALL && r.target_type !== target) return false;
      if (!q) return true;
      return (
        r.action.toLowerCase().includes(q) ||
        (r.target_id ?? "").toLowerCase().includes(q) ||
        (r.actor_id ?? "").toLowerCase().includes(q) ||
        (names[r.actor_id ?? ""] ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, target, names]);

  return (
    <AdminLayout
      title="سجل تدقيق الإدارة"
      description="كل عملية إدارية مسجَّلة مع القيم قبل وبعد التغيير. السجل للقراءة فقط ولا يمكن تعديله أو حذفه."
    >
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالإجراء أو المنفّذ أو الهدف..."
              className="pe-9"
            />
          </div>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="الجدول" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>كل الجداول</SelectItem>
              {targets.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{filtered.length} عملية</Badge>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">لا توجد عمليات مسجَّلة</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ScrollText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{r.action}</span>
                  <Badge variant="outline">{r.target_type}</Badge>
                  {r.actor_role && (
                    <Badge variant="secondary">{ROLE_LABEL[r.actor_role] ?? r.actor_role}</Badge>
                  )}
                  <span className="ms-auto text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ar-SY")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  المنفّذ: {names[r.actor_id ?? ""] ?? r.actor_id ?? "—"}
                  {r.target_id && ` · الهدف: ${r.target_id.slice(0, 8)}`}
                </p>
                {r.reason && <p className="text-xs text-primary">السبب: {r.reason}</p>}
                {(r.old_value || r.new_value) && (
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-relaxed" dir="ltr">
{JSON.stringify({ before: r.old_value ?? null, after: r.new_value ?? null }, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminAuditLog;

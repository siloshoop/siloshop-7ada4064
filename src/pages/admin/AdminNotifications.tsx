import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

type Audience = "customers" | "vendors" | "all";

interface RecipientRow {
  id: string;
  full_name: string | null;
  role: "customer" | "vendor";
}

interface SentRow {
  id: string;
  title: string;
  message: string;
  created_at: string;
  type: string;
}

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "customers", label: "جميع المشترين" },
  { value: "vendors", label: "جميع البائعين" },
  { value: "all", label: "جميع المستخدمين" },
];

const AdminNotifications = () => {
  const { toast } = useToast();
  const [audience, setAudience] = useState<Audience>("customers");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [recent, setRecent] = useState<SentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profiles }, { data: sent }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, role").limit(5000),
      supabase
        .from("notifications")
        .select("id, title, message, created_at, type")
        .eq("type", "admin")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setRecipients((profiles ?? []) as RecipientRow[]);
    setRecent((sent ?? []) as SentRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const targets = useMemo(() => {
    if (audience === "all") return recipients;
    return recipients.filter((r) =>
      audience === "customers" ? r.role === "customer" : r.role === "vendor",
    );
  }, [recipients, audience]);

  const send = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "العنوان والنص مطلوبان", variant: "destructive" });
      return;
    }
    if (targets.length === 0) {
      toast({ title: "لا يوجد مستلمون", variant: "destructive" });
      return;
    }
    setSending(true);
    setProgress({ done: 0, total: targets.length });
    let failed = 0;
    const batchSize = 20;
    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((t) =>
          supabase.rpc("send_notification", {
            _target_user_id: t.id,
            _title: title.trim(),
            _message: message.trim(),
            _type: "admin",
          }),
        ),
      );
      failed += results.filter(
        (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value.error),
      ).length;
      setProgress({ done: Math.min(i + batchSize, targets.length), total: targets.length });
    }
    setSending(false);
    setProgress(null);
    if (failed === targets.length) {
      toast({ title: "تعذر إرسال الإشعارات", variant: "destructive" });
      return;
    }
    toast({
      title: "تم الإرسال",
      description: `${targets.length - failed} إشعار تم إرساله${failed ? ` · فشل ${failed}` : ""}`,
    });
    setTitle("");
    setMessage("");
    void load();
  };

  return (
    <AdminLayout
      title="الإشعارات"
      description="إرسال إشعارات داخلية للمشترين أو البائعين، ومتابعة آخر الإشعارات المُرسلة."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" /> إشعار جديد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              عدد المستلمين: {loading ? "..." : targets.length}
            </p>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان الإشعار"
              maxLength={120}
            />
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="نص الإشعار"
              maxLength={500}
              rows={4}
            />
            {progress && (
              <p className="text-xs text-muted-foreground">
                جارٍ الإرسال {progress.done} / {progress.total}
              </p>
            )}
            <Button onClick={send} disabled={sending || loading} className="w-full">
              {sending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="me-2 h-4 w-4" />
              )}
              إرسال
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">آخر الإشعارات الإدارية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">لا توجد إشعارات بعد</p>
            ) : (
              recent.map((n) => (
                <div key={n.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{n.title}</p>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ar })}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminNotifications;
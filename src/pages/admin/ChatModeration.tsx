import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Search,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

type FilterKey = "all" | "active" | "blocked" | "suspended" | "reported";

interface ConversationRow {
  id: string;
  customer_id: string;
  vendor_id: string;
  product_id: string | null;
  customer_name: string | null;
  vendor_name: string | null;
  last_message_at: string | null;
  created_at: string;
  is_blocked: boolean;
  is_suspended: boolean;
  suspended_until: string | null;
  moderation_reason: string | null;
  last_message: string | null;
  message_count: number;
  reported_count: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string | null;
  content: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  is_deleted: boolean;
  deleted_by: string | null;
  deleted_at: string | null;
  created_at: string;
  report_count: number;
}

interface LogRow {
  id: string;
  action: string;
  reason: string | null;
  performed_by: string;
  created_at: string;
  message_id: string | null;
  metadata: Record<string, unknown> | null;
}

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active", label: "نشطة" },
  { key: "blocked", label: "محظورة" },
  { key: "suspended", label: "معلّقة" },
  { key: "reported", label: "مبلَّغ عنها" },
];

const ACTION_LABEL: Record<string, string> = {
  delete_message: "حذف رسالة",
  block: "حظر المحادثة",
  unblock: "رفع الحظر",
  suspend: "تعليق المحادثة",
  unsuspend: "رفع التعليق",
};

const PAGE_SIZE = 50;

const ChatModeration = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);

  // action dialogs
  const [blockOpen, setBlockOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<MessageRow | null>(null);
  const [reason, setReason] = useState("");
  const [suspendedUntil, setSuspendedUntil] = useState("");

  const fetchList = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_conversations", {
      _search: search.trim() || null,
      _filter: filter,
      _limit: PAGE_SIZE,
      _offset: page * PAGE_SIZE,
    });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as ConversationRow[]);
    }
    setLoading(false);
  }, [search, filter, page, toast]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const channel = supabase
      .channel("chat-moderation-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchList())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchList]);

  const openDetail = useCallback(
    async (row: ConversationRow) => {
      setSelected(row);
      setLoadingDetail(true);
      const [{ data: msgs, error: mErr }, { data: logRows, error: lErr }] = await Promise.all([
        supabase.rpc("admin_get_conversation_messages", { _conversation_id: row.id }),
        supabase
          .from("chat_moderation_log")
          .select("id, action, reason, performed_by, created_at, message_id, metadata")
          .eq("conversation_id", row.id)
          .order("created_at", { ascending: false }),
      ]);
      if (mErr) toast({ title: "خطأ", description: mErr.message, variant: "destructive" });
      if (lErr) toast({ title: "خطأ", description: lErr.message, variant: "destructive" });
      setMessages((msgs ?? []) as MessageRow[]);
      setLogs((logRows ?? []) as LogRow[]);
      setLoadingDetail(false);
    },
    [toast],
  );

  const refreshDetail = useCallback(async () => {
    if (!selected) return;
    await openDetail(selected);
    await fetchList();
  }, [selected, openDetail, fetchList]);

  const doBlock = async (block: boolean) => {
    if (!selected) return;
    if (block && !reason.trim()) {
      toast({ title: "أدخل السبب", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_block_conversation", {
      _conversation_id: selected.id,
      _reason: reason.trim() || null,
      _block: block,
    });
    setBusy(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: block ? "تم حظر المحادثة" : "تم رفع الحظر" });
    setBlockOpen(false);
    setReason("");
    await refreshDetail();
  };

  const doSuspend = async (suspend: boolean) => {
    if (!selected) return;
    if (suspend && !reason.trim()) {
      toast({ title: "أدخل السبب", variant: "destructive" });
      return;
    }
    setBusy(true);
    const until = suspend && suspendedUntil ? new Date(suspendedUntil).toISOString() : null;
    const { error } = await supabase.rpc("admin_suspend_conversation", {
      _conversation_id: selected.id,
      _reason: reason.trim() || null,
      _until: until,
      _suspend: suspend,
    });
    setBusy(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: suspend ? "تم تعليق المحادثة" : "تم رفع التعليق" });
    setSuspendOpen(false);
    setReason("");
    setSuspendedUntil("");
    await refreshDetail();
  };

  const doDeleteMessage = async () => {
    if (!deleteMsg) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_delete_message", {
      _message_id: deleteMsg.id,
      _reason: reason.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم حذف الرسالة" });
    setDeleteMsg(null);
    setReason("");
    await refreshDetail();
  };

  const statusBadge = (row: ConversationRow) => {
    const nowActiveSuspension =
      row.is_suspended && (!row.suspended_until || new Date(row.suspended_until) > new Date());
    if (row.is_blocked)
      return (
        <Badge variant="destructive" className="gap-1">
          <ShieldOff className="h-3 w-3" /> محظورة
        </Badge>
      );
    if (nowActiveSuspension)
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" /> معلّقة
        </Badge>
      );
    return (
      <Badge variant="outline" className="gap-1">
        <ShieldCheck className="h-3 w-3" /> نشطة
      </Badge>
    );
  };

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6" /> إشراف الدردشة
            </h1>
            <p className="text-sm text-muted-foreground">
              مراجعة المحادثات، حذف الرسائل، حظر أو تعليق الدردشات، والاطلاع على سجل الإشراف.
            </p>
          </div>
        </div>

        <Card className="mb-4">
          <CardContent className="pt-6 flex flex-col md:flex-row gap-3 items-stretch md:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">بحث</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="اسم مستخدم أو نص رسالة"
                  className="pr-9"
                />
              </div>
            </div>
            <div className="w-full md:w-56">
              <label className="text-sm font-medium mb-1 block">التصفية</label>
              <Select
                value={filter}
                onValueChange={(v) => {
                  setFilter(v as FilterKey);
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">المحادثات ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">لا توجد محادثات مطابقة.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => openDetail(row)}
                    className="w-full text-right rounded-lg border p-3 hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">
                          {row.customer_name || "مشتري"} ↔ {row.vendor_name || "بائع"}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {row.last_message || "لا توجد رسائل بعد"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {statusBadge(row)}
                        {row.reported_count > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> {row.reported_count} بلاغ
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{row.message_count} رسالة</span>
                      <span>
                        {row.last_message_at
                          ? formatDistanceToNow(new Date(row.last_message_at), {
                              addSuffix: true,
                              locale: ar,
                            })
                          : ""}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center mt-4 gap-2">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                السابق
              </Button>
              <span className="text-sm text-muted-foreground">صفحة {page + 1}</span>
              <Button
                variant="outline"
                disabled={rows.length < PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />

      {/* Detail dialog */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setMessages([]);
            setLogs([]);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              محادثة {selected?.customer_name || "مشتري"} ↔ {selected?.vendor_name || "بائع"}
            </DialogTitle>
            <DialogDescription>
              {selected && (
                <span className="flex flex-wrap items-center gap-2">
                  {statusBadge(selected)}
                  {selected.moderation_reason && (
                    <span className="text-xs">السبب: {selected.moderation_reason}</span>
                  )}
                  {selected.suspended_until && (
                    <span className="text-xs">
                      حتى: {new Date(selected.suspended_until).toLocaleString("ar")}
                    </span>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <>
              <div className="flex flex-wrap gap-2">
                {selected.is_blocked ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReason("");
                      doBlock(false);
                    }}
                    disabled={busy}
                  >
                    <ShieldCheck className="h-4 w-4 ml-1" /> رفع الحظر
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setReason("");
                      setBlockOpen(true);
                    }}
                  >
                    <ShieldOff className="h-4 w-4 ml-1" /> حظر المحادثة
                  </Button>
                )}
                {selected.is_suspended ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReason("");
                      doSuspend(false);
                    }}
                    disabled={busy}
                  >
                    <ShieldCheck className="h-4 w-4 ml-1" /> رفع التعليق
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setReason("");
                      setSuspendedUntil("");
                      setSuspendOpen(true);
                    }}
                  >
                    <Clock className="h-4 w-4 ml-1" /> تعليق مؤقت
                  </Button>
                )}
              </div>

              <div className="border rounded-lg p-3 max-h-[420px] overflow-y-auto space-y-2 bg-muted/30">
                {loadingDetail ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">لا توجد رسائل.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-md border p-2 text-sm ${
                        m.is_deleted ? "bg-muted opacity-70" : "bg-background"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-xs mb-0.5">
                            {m.sender_name || "مستخدم"}
                            {m.report_count > 0 && (
                              <Badge variant="destructive" className="mr-2 text-[10px]">
                                {m.report_count} بلاغ
                              </Badge>
                            )}
                          </p>
                          {m.message_type === "image" && m.file_url && !m.is_deleted && (
                            <img
                              src={m.file_url}
                              alt=""
                              className="max-w-[200px] rounded mb-1"
                              loading="lazy"
                            />
                          )}
                          {m.message_type === "file" && m.file_url && !m.is_deleted && (
                            <a
                              href={m.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline text-primary"
                            >
                              📎 {m.file_name}
                            </a>
                          )}
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(m.created_at).toLocaleString("ar")}
                          </p>
                        </div>
                        {!m.is_deleted && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              setDeleteMsg(m);
                              setReason("");
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-1">
                  <ShieldAlert className="h-4 w-4" /> سجل الإشراف
                </h3>
                {logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لا توجد إجراءات سابقة.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {logs.map((l) => (
                      <li key={l.id} className="flex justify-between gap-2 border-b py-1">
                        <span>
                          <Badge variant="outline" className="ml-1">
                            {ACTION_LABEL[l.action] || l.action}
                          </Badge>
                          {l.reason && <span className="text-muted-foreground">— {l.reason}</span>}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(l.created_at), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Block reason dialog */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حظر المحادثة</DialogTitle>
            <DialogDescription>لن يتمكن المشتري ولا البائع من إرسال رسائل جديدة.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="سبب الحظر"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)} disabled={busy}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={() => doBlock(true)} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin ml-1" />} تأكيد الحظر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعليق مؤقت للمحادثة</DialogTitle>
            <DialogDescription>
              اترك تاريخ الانتهاء فارغاً للتعليق حتى إشعار آخر.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="سبب التعليق"
            rows={3}
          />
          <div>
            <label className="text-sm font-medium mb-1 block">تاريخ الانتهاء (اختياري)</label>
            <Input
              type="datetime-local"
              value={suspendedUntil}
              onChange={(e) => setSuspendedUntil(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)} disabled={busy}>
              إلغاء
            </Button>
            <Button onClick={() => doSuspend(true)} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin ml-1" />} تأكيد التعليق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete message dialog */}
      <Dialog open={!!deleteMsg} onOpenChange={(o) => !o && setDeleteMsg(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف الرسالة</DialogTitle>
            <DialogDescription>
              سيتم استبدال محتوى الرسالة بنص "تم حذف الرسالة من قبل الإدارة".
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-2 text-sm bg-muted/40 max-h-40 overflow-y-auto">
            {deleteMsg?.content}
          </div>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="سبب الحذف (اختياري)"
            rows={2}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMsg(null)} disabled={busy}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={doDeleteMessage} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin ml-1" />} حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatModeration;
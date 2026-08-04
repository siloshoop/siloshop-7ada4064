import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Loader2,
  ScrollText,
  Search,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  Eye,
  EyeOff,
  ArrowUpDown,
  CalendarClock,
  ArrowRight,
} from "lucide-react";

interface AuditRow {
  id: string;
  showroom_item_id: string | null;
  item_title: string | null;
  action: string;
  changed_fields: string[] | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  performed_by: string | null;
  performed_by_role: string | null;
  created_at: string;
}

const actionMeta: Record<
  string,
  { label: string; icon: JSX.Element; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  create: { label: "إنشاء", icon: <Plus className="h-3.5 w-3.5" />, variant: "default" },
  update: { label: "تعديل", icon: <Pencil className="h-3.5 w-3.5" />, variant: "secondary" },
  delete: { label: "حذف", icon: <Trash2 className="h-3.5 w-3.5" />, variant: "destructive" },
  publish: { label: "نشر", icon: <Eye className="h-3.5 w-3.5" />, variant: "default" },
  unpublish: { label: "تعطيل", icon: <EyeOff className="h-3.5 w-3.5" />, variant: "destructive" },
  pin: { label: "تثبيت", icon: <Pin className="h-3.5 w-3.5" />, variant: "default" },
  unpin: { label: "إلغاء التثبيت", icon: <PinOff className="h-3.5 w-3.5" />, variant: "secondary" },
  reorder: { label: "إعادة ترتيب", icon: <ArrowUpDown className="h-3.5 w-3.5" />, variant: "secondary" },
  schedule: { label: "جدولة", icon: <CalendarClock className="h-3.5 w-3.5" />, variant: "outline" },
};

const fieldLabels: Record<string, string> = {
  is_active: "الحالة",
  is_pinned: "التثبيت",
  display_order: "ترتيب العرض",
  start_date: "تاريخ البدء",
  end_date: "تاريخ الانتهاء",
  priority: "الأولوية",
  title: "العنوان",
};

const roleLabels: Record<string, string> = {
  super_admin: "مدير عام",
  admin: "مدير",
  unknown: "غير معروف",
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "مُفعّل" : "مُعطّل";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return format(new Date(value), "dd MMM yyyy HH:mm", { locale: ar });
  }
  return String(value);
};

const ShowroomAuditLog = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const { toast } = useToast();

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("showroom_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setRows((data || []) as unknown as AuditRow[]);
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "تعذّر تحميل سجل التدقيق",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filtered = rows.filter((row) => {
    const matchesAction = actionFilter === "all" || row.action === actionFilter;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      row.item_title?.toLowerCase().includes(q) ||
      row.action.includes(q) ||
      row.showroom_item_id?.toLowerCase().includes(q);
    return matchesAction && matchesQuery;
  });

  if (adminLoading || loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="container flex-1 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <ScrollText className="h-6 w-6 text-primary" />
                سجل تدقيق المعرض المميز
              </h1>
              <p className="text-sm text-muted-foreground">
                تتبّع كل عمليات المدير العام على عناصر المعرض ({rows.length} عملية)
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={fetchRows}>
                <RefreshCw className="h-4 w-4" /> تحديث
              </Button>
              <Button asChild variant="secondary" className="gap-2">
                <Link to="/dashboard/showroom">
                  <ArrowRight className="h-4 w-4" /> إدارة المعرض
                </Link>
              </Button>
            </div>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="بحث بعنوان العنصر أو نوع العملية..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-full md:w-56">
                    <SelectValue placeholder="فلترة حسب العملية" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع العمليات</SelectItem>
                    {Object.entries(actionMeta).map(([key, meta]) => (
                      <SelectItem key={key} value={key}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ScrollText className="mx-auto mb-4 h-14 w-14 text-muted-foreground/20" />
                  <p className="text-muted-foreground">لا توجد عمليات مطابقة.</p>
                </CardContent>
              </Card>
            ) : (
              filtered.map((row) => {
                const meta = actionMeta[row.action] ?? {
                  label: row.action,
                  icon: <Pencil className="h-3.5 w-3.5" />,
                  variant: "secondary" as const,
                };
                return (
                  <Card key={row.id} className="transition-shadow hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={meta.variant} className="flex items-center gap-1">
                              {meta.icon}
                              {meta.label}
                            </Badge>
                            <span className="font-medium">{row.item_title || "عنصر محذوف"}</span>
                            <Badge variant="outline">
                              {roleLabels[row.performed_by_role || "unknown"] || row.performed_by_role}
                            </Badge>
                          </div>

                          {row.changed_fields && row.changed_fields.length > 0 && (
                            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                              {row.changed_fields.map((field) => (
                                <li key={field}>
                                  <span className="text-foreground">{fieldLabels[field] || field}</span>
                                  {": "}
                                  {formatValue(row.old_values?.[field])}
                                  {" ← "}
                                  {formatValue(row.new_values?.[field])}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="text-left text-sm text-muted-foreground">
                          {format(new Date(row.created_at), "dd MMM yyyy", { locale: ar })}
                          <br />
                          <span className="text-xs">
                            {format(new Date(row.created_at), "HH:mm", { locale: ar })}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ShowroomAuditLog;

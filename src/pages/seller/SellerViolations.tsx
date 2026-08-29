import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { violationSeverityClass, violationSeverityLabel } from "@/lib/violations";

interface ViolationRow {
  id: string;
  severity: string;
  reason_code: string;
  reason: string | null;
  status: string;
  created_at: string;
  revoked_at: string | null;
}

const SellerViolations = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<ViolationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("seller_violations")
        .select("id,severity,reason_code,reason,status,created_at,revoked_at")
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) toast({ title: "تعذّر تحميل المخالفات", description: error.message, variant: "destructive" });
      setRows((data ?? []) as ViolationRow[]);
      setLoading(false);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const activeStrikes = rows.filter((r) => r.status === "active" && r.severity !== "warning").length;

  return (
    <SellerLayout title="المخالفات والإنذارات" description="سجل الإنذارات والمخالفات الصادرة من إدارة المنصة على متجرك.">
      <Card className={`mb-4 ${activeStrikes >= 2 ? "border-destructive/50" : ""}`}>
        <CardContent className="flex items-center gap-3 p-4">
          {activeStrikes > 0 ? (
            <ShieldAlert className="h-5 w-5 text-destructive" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          )}
          <div>
            <p className="font-semibold">
              {activeStrikes > 0 ? `لديك ${activeStrikes} مخالفة سارية` : "لا توجد مخالفات سارية على متجرك"}
            </p>
            <p className="text-sm text-muted-foreground">
              يتم إيقاف الحساب تلقائياً عند بلوغ 3 مخالفات سارية. الإنذارات لا تُحتسب ضمن المخالفات.
            </p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">سجلك نظيف — لا توجد أي مخالفات.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className={r.status === "revoked" ? "opacity-60" : ""}>
              <CardContent className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">{r.reason_code}</p>
                  {r.reason && <p className="text-sm text-muted-foreground">{r.reason}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ar-SY")}
                    {r.status === "revoked" && r.revoked_at && ` — أُلغيت في ${new Date(r.revoked_at).toLocaleDateString("ar-SY")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={violationSeverityClass(r.severity)}>
                    {violationSeverityLabel(r.severity)}
                  </Badge>
                  <Badge variant={r.status === "active" ? "destructive" : "outline"}>
                    {r.status === "active" ? "سارية" : "ملغاة"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </SellerLayout>
  );
};

export default SellerViolations;

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wallet } from "lucide-react";
import type { SellerWallet as WalletSummary } from "@/hooks/useSellerDashboard";

interface PayoutRow {
  id: string;
  amount: number;
  method: string;
  details: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
}

const currency = (n: number) => `${Math.round(Number(n) || 0).toLocaleString("ar-SY")} ل.س`;

const STATUS: Record<string, { label: string; variant: "secondary" | "default" | "destructive" | "outline" }> = {
  pending: { label: "قيد المراجعة", variant: "secondary" },
  approved: { label: "تمت الموافقة", variant: "default" },
  rejected: { label: "مرفوض", variant: "destructive" },
  completed: { label: "تم التحويل", variant: "outline" },
};

const METHODS = ["شام كاش", "حوالة داخلية", "تسليم نقدي"];

const ERRORS: Record<string, string> = {
  pending_request_exists: "لديك طلب سحب قيد المراجعة بالفعل.",
  amount_exceeds_balance: "المبلغ المطلوب أكبر من الرصيد القابل للسحب.",
  invalid_amount: "أدخل مبلغاً صحيحاً أكبر من صفر.",
  not_approved_seller: "طلبات السحب متاحة للبائعين المعتمدين فقط.",
};

const SellerWallet = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: w }, { data: p }] = await Promise.all([
      supabase.rpc("seller_wallet_summary"),
      supabase
        .from("payout_requests")
        .select("id,amount,method,details,status,review_note,created_at")
        .order("created_at", { ascending: false }),
    ]);
    setWallet((w as unknown as WalletSummary) ?? null);
    setRows((p as PayoutRow[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("seller-payouts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "payout_requests" }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast({ title: "أدخل مبلغاً صحيحاً", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("seller_request_payout", {
      _amount: value,
      _method: method,
      _details: details.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
      toast({ title: "تعذّر إرسال الطلب", description: key ? ERRORS[key] : error.message, variant: "destructive" });
      return;
    }
    setAmount("");
    setDetails("");
    toast({ title: "تم إرسال طلب السحب", description: "ستصلك النتيجة بعد مراجعة الإدارة." });
    void load();
  };

  const kpis = [
    { label: "إيراد مُحقَّق (طلبات مسلّمة)", value: wallet?.settled_revenue ?? 0 },
    { label: "رصيد معلّق (طلبات جارية)", value: wallet?.pending_revenue ?? 0 },
    { label: "رصيد قابل للسحب", value: wallet?.withdrawable ?? 0 },
    { label: "محجوز في طلبات سحب", value: wallet?.locked_in_requests ?? 0 },
    { label: "إجمالي ما تم تحويله", value: wallet?.paid_out ?? 0 },
    { label: "ملغى / مُرجَع", value: wallet?.refunded_revenue ?? 0 },
  ];

  return (
    <SellerLayout title="المحفظة والسحوبات" description="أرصدتك وسجل عمليات السحب">
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <Wallet className="mb-2 h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">{k.label}</p>
              {loading ? <Skeleton className="mt-1 h-6 w-20" /> : <p className="text-sm font-bold">{currency(k.value)}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3"><CardTitle className="text-base">طلب سحب جديد</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="payout-amount">المبلغ (ل.س)</Label>
              <Input id="payout-amount" type="number" min={0} inputMode="numeric" value={amount}
                onChange={(ev) => setAmount(ev.target.value)} placeholder="0" />
              <p className="text-xs text-muted-foreground">المتاح: {currency(wallet?.withdrawable ?? 0)}</p>
            </div>
            <div className="space-y-1.5">
              <Label>طريقة الاستلام</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payout-details">بيانات الاستلام (اختياري)</Label>
              <Textarea id="payout-details" value={details} maxLength={500}
                onChange={(ev) => setDetails(ev.target.value)} placeholder="رقم المحفظة أو تفاصيل التحويل" />
            </div>
            <Button className="w-full" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "إرسال الطلب"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">سجل السحوبات</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد طلبات سحب بعد.</p>
            ) : (
              rows.map((r) => {
                const st = STATUS[r.status] ?? { label: r.status, variant: "secondary" as const };
                return (
                  <div key={r.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{currency(r.amount)}</span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      <span className="text-xs text-muted-foreground">{r.method}</span>
                      <span className="ms-auto text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("ar-SY")}
                      </span>
                    </div>
                    {r.review_note && <p className="mt-1 text-xs text-muted-foreground">ملاحظة الإدارة: {r.review_note}</p>}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
};

export default SellerWallet;

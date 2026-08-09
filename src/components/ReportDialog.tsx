import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ReportKind = "product" | "seller" | "review";

const REASONS: Record<ReportKind, string[]> = {
  product: [
    "منتج مقلّد أو غير أصلي",
    "وصف أو صور مضللة",
    "سعر غير منطقي أو احتيالي",
    "محتوى غير لائق",
    "منتج محظور أو خطير",
  ],
  seller: [
    "بائع غير موثوق أو محتال",
    "تعامل غير لائق مع العملاء",
    "لا يسلّم الطلبات",
    "معلومات المتجر مضللة",
    "مخالفة سياسات المنصة",
  ],
  review: ["مراجعة مسيئة", "مراجعة مزيفة", "محتوى غير مرتبط بالمنتج"],
};

const TITLES: Record<ReportKind, string> = {
  product: "الإبلاغ عن منتج",
  seller: "الإبلاغ عن بائع",
  review: "الإبلاغ عن مراجعة",
};

interface Props {
  kind: ReportKind;
  targetId: string;
  targetName?: string | null;
  variant?: "ghost" | "outline" | "secondary";
  size?: "sm" | "default" | "icon";
  className?: string;
  label?: string;
}

/** Simple buyer-facing report flow backed by the submit_report RPC. */
const ReportDialog = ({
  kind,
  targetId,
  targetName,
  variant = "ghost",
  size = "sm",
  className,
  label,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    if (!reason) {
      toast({ title: "اختر سبب البلاغ", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "تسجيل الدخول مطلوب",
          description: "يرجى تسجيل الدخول لإرسال بلاغ",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.rpc("submit_report", {
        _report_type: kind,
        _target_id: targetId,
        _reason: reason,
        _description: description.trim() || null,
      });
      if (error) throw error;

      toast({
        title: "تم إرسال البلاغ",
        description: "سيقوم فريق الإشراف بمراجعة بلاغك في أقرب وقت.",
      });
      setOpen(false);
      setReason("");
      setDescription("");
    } catch (err: any) {
      const msg = String(err?.message || "");
      toast({
        title: "تعذر إرسال البلاغ",
        description: msg.includes("rate_limited")
          ? "لقد أرسلت عدداً كبيراً من البلاغات، حاول لاحقاً."
          : "يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Flag className={size === "icon" ? "h-4 w-4" : "ml-2 h-4 w-4"} />
          {size !== "icon" && (label ?? "إبلاغ")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>{TITLES[kind]}</DialogTitle>
          <DialogDescription>
            {targetName ? `${targetName} — ` : ""}اختر السبب وأضف تفاصيل إن وُجدت. بلاغك سرّي.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
            {REASONS[kind].map((r) => (
              <div key={r} className="flex items-center gap-2 rounded-lg border p-2.5">
                <RadioGroupItem value={r} id={`${kind}-${r}`} />
                <Label htmlFor={`${kind}-${r}`} className="cursor-pointer text-sm font-normal">
                  {r}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-1.5">
            <Label htmlFor="report-details" className="text-sm">
              تفاصيل إضافية (اختياري)
            </Label>
            <Textarea
              id="report-details"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={800}
              rows={3}
              placeholder="اشرح المشكلة بإيجاز..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={submit} disabled={submitting || !reason}>
            {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            إرسال البلاغ
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;

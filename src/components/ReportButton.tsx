import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

export type ReportType = "product" | "seller" | "buyer" | "message" | "review";

interface ReportButtonProps {
  reportType: ReportType;
  targetId: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  label?: string;
  className?: string;
}

const REASONS: Record<ReportType, string[]> = {
  product: ["منتج مزيف أو مقلد", "وصف مضلل", "محتوى غير لائق", "سعر غير معقول", "مخالف للقانون", "أخرى"],
  seller: ["محتال أو غير موثوق", "لا يرد على العملاء", "منتجات مقلدة", "خدمة سيئة", "أخرى"],
  buyer: ["مضايقة أو إساءة", "طلبات مزيفة", "احتيال", "أخرى"],
  message: ["إساءة أو تحرش", "محتوى غير لائق", "سبام أو إعلانات", "معلومات مضللة", "أخرى"],
  review: ["تقييم كاذب", "لغة مسيئة", "غير متعلق بالمنتج", "سبام", "أخرى"],
};

const ReportButton = ({ reportType, targetId, variant = "outline", size = "sm", label = "إبلاغ", className }: ReportButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!reason || reason.trim().length < 3) {
      toast({ title: "يرجى اختيار سبب البلاغ", variant: "destructive" });
      return;
    }
    if (description.length > 1000) {
      toast({ title: "الوصف طويل جداً", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_report", {
      _report_type: reportType,
      _target_id: targetId,
      _reason: reason,
      _description: description.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      const msg = error.message.includes("rate_limited")
        ? "لقد أرسلت عدداً كبيراً من البلاغات. حاول لاحقاً."
        : error.message.includes("target_not_found")
          ? "لم يعد الهدف موجوداً"
          : "تعذر إرسال البلاغ";
      toast({ title: msg, variant: "destructive" });
      return;
    }
    toast({ title: "تم إرسال البلاغ", description: "سيقوم فريق الإدارة بمراجعته قريباً." });
    setOpen(false);
    setReason("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className} aria-label="إبلاغ">
          <Flag className="h-4 w-4 ml-1" />
          {size !== "icon" && <span>{label}</span>}
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>إرسال بلاغ</DialogTitle>
          <DialogDescription>
            ساعدنا في الحفاظ على المنصة آمنة. جميع البلاغات سرية وتتم مراجعتها من قبل فريق الإدارة.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">سبب البلاغ</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="اختر السبب" /></SelectTrigger>
              <SelectContent>
                {REASONS[reportType].map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">تفاصيل إضافية (اختياري)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              placeholder="وصف مختصر للمشكلة"
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-1">{description.length}/1000</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>إلغاء</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Flag className="h-4 w-4 ml-1" />}
            إرسال البلاغ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportButton;
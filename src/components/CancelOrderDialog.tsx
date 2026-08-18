import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, XCircle } from "lucide-react";

import { normalizeStatus } from "@/lib/orderStatus";

/** Buyers may cancel only while the order is pending / confirmed / preparing. */
const CANCELLABLE_STATUSES = ["pending", "confirmed", "preparing"] as const;

export const canCancelOrder = (
  status: string | null | undefined,
  trackingStatus?: string | null,
) => {
  const stages = [status, trackingStatus].filter(Boolean) as string[];
  if (stages.length === 0) return false;
  return stages.every((s) =>
    (CANCELLABLE_STATUSES as readonly string[]).includes(normalizeStatus(s)),
  );
};

const REASONS = [
  { value: "changed_mind", label: "غيّرت رأيي" },
  { value: "by_mistake", label: "طلبت بالخطأ" },
  { value: "better_price", label: "وجدت سعرًا أفضل" },
  { value: "delivery_too_long", label: "التوصيل يستغرق وقتًا طويلًا" },
  { value: "other", label: "سبب آخر" },
];

interface Props {
  orderId: string;
  status: string | null | undefined;
  trackingStatus?: string | null;
  onCancelled?: () => void;
  size?: "sm" | "default";
  variant?: "outline" | "destructive" | "default";
  fullWidth?: boolean;
}

const CancelOrderDialog = ({ orderId, status, trackingStatus, onCancelled, size = "sm", variant = "destructive", fullWidth }: Props) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!canCancelOrder(status, trackingStatus)) return null;

  const submit = async () => {
    if (!reason) {
      toast({ title: "يرجى اختيار سبب الإلغاء", variant: "destructive" });
      return;
    }
    const label = REASONS.find((r) => r.value === reason)?.label || "";
    const finalReason =
      reason === "other"
        ? details.trim() || label
        : details.trim()
        ? `${label} — ${details.trim()}`
        : label;

    setLoading(true);
    const { error } = await supabase.rpc("cancel_order", {
      _order_id: orderId,
      _reason: finalReason,
    });
    setLoading(false);

    if (error) {
      toast({
        title: "تعذر إلغاء الطلب",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "تم إلغاء الطلب بنجاح" });
    setOpen(false);
    setReason("");
    setDetails("");
    onCancelled?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={fullWidth ? "w-full sm:w-auto" : undefined}
        >
          <XCircle className="h-4 w-4 ml-1" />
          إلغاء الطلب
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>هل أنت متأكد من إلغاء الطلب؟</AlertDialogTitle>
          <AlertDialogDescription>
            لا يمكن التراجع عن هذا الإجراء. سيتم إعادة الكميات إلى المخزون وإشعار البائع.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">سبب الإلغاء</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
              {REASONS.map((r) => (
                <div key={r.value} className="flex items-center gap-2">
                  <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                  <Label htmlFor={`reason-${r.value}`} className="cursor-pointer font-normal">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          {reason === "other" && (
            <div>
              <Label htmlFor="cancel-details" className="mb-1 block">
                يرجى توضيح السبب
              </Label>
              <Textarea
                id="cancel-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="اكتب السبب هنا..."
                maxLength={300}
              />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>تراجع</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void submit();
            }}
            disabled={loading || !reason || (reason === "other" && !details.trim())}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد الإلغاء"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CancelOrderDialog;
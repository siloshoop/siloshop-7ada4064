import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw, Loader2, X, ImagePlus, Video } from "lucide-react";
import {
  RETURN_REASONS,
  isReturnEligible,
  returnDaysRemaining,
  RETURN_WINDOW_DAYS,
  type ReturnReason,
} from "@/lib/returnStatus";

interface ReturnRequestDialogProps {
  order: { id: string; status?: string | null; delivered_at?: string | null };
  orderItemId?: string | null;
  fullWidth?: boolean;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary";
  onCreated?: (returnId: string) => void;
}

const MAX_IMAGES = 5;

const ReturnRequestDialog = ({
  order,
  orderItemId = null,
  fullWidth,
  size = "sm",
  variant = "outline",
  onCreated,
}: ReturnRequestDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReturnReason | "">("");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<boolean>(false);
  const [checking, setChecking] = useState(true);

  const eligibility = isReturnEligible(order);
  const daysLeft = returnDaysRemaining(order.delivered_at);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user || !eligibility.eligible) {
        setChecking(false);
        return;
      }
      let q = supabase
        .from("returns")
        .select("id, status")
        .eq("order_id", order.id)
        .eq("customer_id", user.id)
        .not("status", "in", "(closed,rejected)")
        .limit(1);
      if (orderItemId) q = q.eq("order_item_id", orderItemId);
      else q = q.is("order_item_id", null);
      const { data } = await q;
      if (alive) {
        setExisting((data?.length ?? 0) > 0);
        setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, order.id, orderItemId, eligibility.eligible]);

  if (!eligibility.eligible || existing || checking) return null;

  const handleImages = (files: FileList | null) => {
    if (!files) return;
    const next = [...images, ...Array.from(files)].slice(0, MAX_IMAGES);
    setImages(next);
  };

  const removeImage = (idx: number) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  const uploadFile = async (file: File, prefix: string) => {
    if (!user) throw new Error("not_authenticated");
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${order.id}/${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("returns-media").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    return path;
  };

  const submit = async () => {
    if (!reason) {
      toast({ title: "اختر سبب الإرجاع", variant: "destructive" });
      return;
    }
    if (notes.trim().length < 10) {
      toast({
        title: "وصف المشكلة مطلوب",
        description: "اكتب 10 أحرف على الأقل لشرح سبب الإرجاع",
        variant: "destructive",
      });
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      const imagePaths: string[] = [];
      for (const f of images) imagePaths.push(await uploadFile(f, "img"));
      let videoPath: string | null = null;
      if (video) videoPath = await uploadFile(video, "vid");

      const { data, error } = await supabase.rpc("create_return_request", {
        _order_id: order.id,
        _order_item_id: orderItemId,
        _reason: reason,
        _notes: notes || null,
        _images: imagePaths,
        _video_url: videoPath,
      });
      if (error) throw error;
      toast({ title: "تم إرسال طلب الإرجاع", description: "سيتم مراجعته من قبل البائع" });
      setOpen(false);
      setReason("");
      setNotes("");
      setImages([]);
      setVideo(null);
      setExisting(true);
      onCreated?.(data as string);
    } catch (e) {
      const msg = (e as { message?: string })?.message || "";
      const map: Record<string, string> = {
        return_window_expired: `انتهت مدة الإرجاع (${RETURN_WINDOW_DAYS} أيام)`,
        description_required: "يرجى كتابة وصف واضح للمشكلة (10 أحرف على الأقل)",
        reason_required: "اختر سبب الإرجاع",
        order_not_delivered: "لا يمكن الإرجاع قبل استلام الطلب",
        duplicate_return_request: "يوجد طلب إرجاع مفتوح لهذا العنصر",
        too_many_images: `الحد الأقصى ${MAX_IMAGES} صور`,
        not_order_owner: "غير مصرح لك",
      };
      toast({
        title: "تعذر إرسال الطلب",
        description: map[msg] || "حدث خطأ، حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={fullWidth ? "w-full sm:w-auto" : ""}
        onClick={() => setOpen(true)}
      >
        <RotateCcw className="h-4 w-4 ml-1" />
        طلب إرجاع
      </Button>
      <Dialog open={open} onOpenChange={(v) => !submitting && setOpen(v)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>طلب إرجاع منتج</DialogTitle>
            <DialogDescription>
              اختر السبب واشرح المشكلة، ويمكنك إرفاق حتى {MAX_IMAGES} صور.
              {daysLeft !== null && ` (متبقٍ ${daysLeft} يوم من مدة الإرجاع)`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>سبب الإرجاع *</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as ReturnReason)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر السبب" />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>وصف المشكلة *</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
                placeholder="اشرح المشكلة بمزيد من التفاصيل..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{notes.trim().length}/10 حرف كحد أدنى</p>
            </div>
            <div className="space-y-2">
              <Label>الصور (اختياري — حتى {MAX_IMAGES})</Label>
              <label className="flex items-center gap-2 border border-dashed rounded-md p-3 cursor-pointer hover:bg-muted/40">
                <ImagePlus className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">
                  اضغط لإضافة صور ({images.length}/{MAX_IMAGES})
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImages(e.target.files)}
                  disabled={images.length >= MAX_IMAGES}
                />
              </label>
              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((f, i) => (
                    <div key={i} className="relative aspect-square rounded overflow-hidden bg-muted">
                      <img
                        src={URL.createObjectURL(f)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                        aria-label="حذف الصورة"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>فيديو (اختياري)</Label>
              <label className="flex items-center gap-2 border border-dashed rounded-md p-3 cursor-pointer hover:bg-muted/40">
                <Video className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">
                  {video ? video.name : "اختر ملف فيديو"}
                </span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => setVideo(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              إلغاء
            </Button>
            <Button onClick={submit} disabled={submitting || !reason}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
              إرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReturnRequestDialog;
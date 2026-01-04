import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DeliveryRatingProps {
  orderId: string;
  userId: string;
  isDelivered: boolean;
  existingRating?: number;
  onRatingSubmitted?: () => void;
}

const DeliveryRating = ({ orderId, userId, isDelivered, existingRating, onRatingSubmitted }: DeliveryRatingProps) => {
  const [rating, setRating] = useState(existingRating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار تقييم",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("delivery_ratings")
        .insert({
          order_id: orderId,
          user_id: userId,
          rating,
          comment: comment.trim() || null,
        });

      if (error) throw error;

      toast({
        title: "شكراً لتقييمك",
        description: "تم إرسال تقييم خدمة التوصيل بنجاح",
      });
      setOpen(false);
      onRatingSubmitted?.();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إرسال التقييم",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isDelivered || existingRating) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Truck className="h-4 w-4" />
          قيّم التوصيل
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-center">قيّم خدمة التوصيل</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`h-10 w-10 ${
                    star <= (hoverRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-muted-foreground">
            {rating === 0 && "اختر تقييمك"}
            {rating === 1 && "سيء جداً"}
            {rating === 2 && "سيء"}
            {rating === 3 && "متوسط"}
            {rating === 4 && "جيد"}
            {rating === 5 && "ممتاز"}
          </p>
          <Textarea
            placeholder="أضف تعليقاً (اختياري)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[100px]"
          />
          <Button
            onClick={handleSubmit}
            disabled={loading || rating === 0}
            className="w-full"
          >
            {loading ? "جاري الإرسال..." : "إرسال التقييم"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryRating;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, Store, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface VendorRatingProps {
  vendorId: string;
  vendorName: string;
}

export const VendorRating = ({ vendorId, vendorName }: VendorRatingProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [averageRating, setAverageRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState("");
  const [hasUserRated, setHasUserRated] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchVendorRating();
  }, [vendorId, user]);

  const fetchVendorRating = async () => {
    // Fetch all ratings for vendor
    const { data: ratings } = await supabase
      .from("vendor_ratings")
      .select("*")
      .eq("vendor_id", vendorId);

    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      setAverageRating(Math.round(avg * 10) / 10);
      setTotalRatings(ratings.length);

      // Check if user has rated
      if (user) {
        const userRatingData = ratings.find(r => r.user_id === user.id);
        if (userRatingData) {
          setHasUserRated(true);
          setUserRating(userRatingData.rating);
          setUserComment(userRatingData.comment || "");
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "تسجيل الدخول مطلوب",
        description: "يجب تسجيل الدخول لتقييم البائع",
        variant: "destructive",
      });
      return;
    }

    if (user.id === vendorId) {
      toast({
        title: "خطأ",
        description: "لا يمكنك تقييم نفسك",
        variant: "destructive",
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار تقييم بالنجوم",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (hasUserRated) {
        // Update existing rating
        const { error } = await supabase
          .from("vendor_ratings")
          .update({
            rating,
            comment: comment.trim() || null,
          })
          .eq("vendor_id", vendorId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Create new rating
        const { error } = await supabase.from("vendor_ratings").insert({
          vendor_id: vendorId,
          user_id: user.id,
          rating,
          comment: comment.trim() || null,
        });

        if (error) throw error;
      }

      toast({
        title: "تم بنجاح",
        description: hasUserRated ? "تم تحديث تقييمك" : "تم إضافة تقييمك للبائع",
      });

      setDialogOpen(false);
      fetchVendorRating();
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const StarRating = ({ value, onHover, onClick, interactive = false, size = "md" }: any) => {
    const sizeClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= (interactive ? hoverRating || value : value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            } ${interactive ? "cursor-pointer" : ""}`}
            onMouseEnter={() => interactive && onHover?.(star)}
            onMouseLeave={() => interactive && onHover?.(0)}
            onClick={() => interactive && onClick?.(star)}
          />
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-muted/30">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">تقييم البائع</p>
              <p className="font-semibold">{vendorName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-left">
              <div className="flex items-center gap-1">
                <span className="text-xl font-bold">{averageRating || "—"}</span>
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              </div>
              <Link 
                to={`/vendor/${vendorId}/ratings`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                {totalRatings} تقييم
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            {user && user.id !== vendorId && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (hasUserRated) {
                        setRating(userRating);
                        setComment(userComment);
                      }
                    }}
                  >
                    {hasUserRated ? "تعديل تقييمي" : "قيّم البائع"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {hasUserRated ? "تعديل تقييمك للبائع" : "تقييم البائع"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        تقييمك لـ {vendorName}
                      </label>
                      <StarRating
                        value={rating}
                        onHover={setHoverRating}
                        onClick={setRating}
                        interactive
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        تعليقك (اختياري)
                      </label>
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="شارك تجربتك مع هذا البائع..."
                        rows={3}
                      />
                    </div>

                    <Button
                      onClick={handleSubmit}
                      disabled={loading || rating === 0}
                      className="w-full"
                    >
                      {hasUserRated ? "تحديث التقييم" : "إرسال التقييم"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
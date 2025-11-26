import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string;
  };
}

interface ProductReviewsProps {
  productId: string;
}

export const ProductReviews = ({ productId }: ProductReviewsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasUserReview, setHasUserReview] = useState(false);
  const [averageRating, setAverageRating] = useState(0);

  useEffect(() => {
    fetchReviews();
  }, [productId, user]);

  const fetchReviews = async () => {
    const { data } = await supabase
      .from("reviews")
      .select(`
        *,
        profiles:user_id (full_name)
      `)
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (data) {
      setReviews(data as any);
      
      // Calculate average rating
      if (data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(Math.round(avg * 10) / 10);
      }

      // Check if user has already reviewed
      if (user) {
        setHasUserReview(data.some(r => r.user_id === user.id));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "تسجيل الدخول مطلوب",
        description: "يجب تسجيل الدخول لإضافة تقييم",
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
      const { error } = await supabase.from("reviews").insert({
        product_id: productId,
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "تم بنجاح",
        description: "تم إضافة تقييمك",
      });

      setRating(0);
      setComment("");
      fetchReviews();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const StarRating = ({ value, onHover, onClick, interactive = false }: any) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-5 w-5 ${
            star <= (interactive ? hoverRating || value : value)
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          } ${interactive ? "cursor-pointer" : ""}`}
          onMouseEnter={() => interactive && onHover(star)}
          onMouseLeave={() => interactive && onHover(0)}
          onClick={() => interactive && onClick(star)}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>التقييمات والمراجعات</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{averageRating}</span>
              <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
              <span className="text-sm text-muted-foreground">
                ({reviews.length} تقييم)
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user && !hasUserReview && (
            <form onSubmit={handleSubmit} className="space-y-4 mb-6 pb-6 border-b">
              <div>
                <label className="text-sm font-medium mb-2 block">تقييمك</label>
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
                  placeholder="شارك تجربتك مع المنتج..."
                  rows={3}
                />
              </div>

              <Button type="submit" disabled={loading || rating === 0}>
                إضافة تقييم
              </Button>
            </form>
          )}

          {hasUserReview && user && (
            <div className="mb-6 pb-6 border-b text-sm text-muted-foreground">
              لقد قمت بتقييم هذا المنتج بالفعل
            </div>
          )}

          <div className="space-y-4">
            {reviews.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                لا توجد تقييمات بعد. كن أول من يقيم هذا المنتج!
              </p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="flex gap-4 pb-4 border-b last:border-0">
                  <Avatar>
                    <AvatarFallback>
                      {review.profiles.full_name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">
                        {review.profiles.full_name || "مستخدم"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(review.created_at), {
                          addSuffix: true,
                          locale: ar,
                        })}
                      </span>
                    </div>
                    <StarRating value={review.rating} />
                    {review.comment && (
                      <p className="mt-2 text-sm text-foreground/80">
                        {review.comment}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

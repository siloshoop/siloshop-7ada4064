import { useEffect, useRef, useState } from "react";
import { Star, MessageCircle, Send, Camera, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import ReviewsChart from "@/components/ReviewsChart";

interface ReviewReply {
  id: string;
  reply: string;
  created_at: string;
  vendor_id: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user_id: string;
  image_url?: string | null;
  profiles: {
    full_name: string;
  };
  review_replies?: ReviewReply[];
}

interface ProductReviewsProps {
  productId: string;
  vendorId?: string;
}

export const ProductReviews = ({ productId, vendorId }: ProductReviewsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasUserReview, setHasUserReview] = useState(false);
  const [averageRating, setAverageRating] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if current user is the vendor of this product
  const isVendor = user?.id === vendorId;

  useEffect(() => {
    fetchReviews();
  }, [productId, user]);

  const fetchReviews = async () => {
    const { data } = await supabase
      .from("reviews")
      .select(`
        *,
        profiles:user_id (full_name),
        review_replies (*)
      `)
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (data) {
      setReviews(data as any);
      
      if (data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(Math.round(avg * 10) / 10);
      }

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
      let uploadedUrl: string | null = null;
      if (imageFile) {
        setUploading(true);
        const ext = imageFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/${productId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("review-images")
          .upload(path, imageFile, { contentType: imageFile.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("review-images").getPublicUrl(path);
        uploadedUrl = pub.publicUrl;
        setUploading(false);
      }

      const { error } = await supabase.from("reviews").insert({
        product_id: productId,
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
        image_url: uploadedUrl,
      });

      if (error) throw error;

      toast({
        title: "تم بنجاح",
        description: "تم إضافة تقييمك",
      });

      setRating(0);
      setComment("");
      setImageFile(null);
      setImagePreview(null);
      fetchReviews();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleReply = async (reviewId: string) => {
    if (!user || !replyText.trim()) return;

    setSubmittingReply(true);
    try {
      const { error } = await supabase.from("review_replies").insert({
        review_id: reviewId,
        vendor_id: user.id,
        reply: replyText.trim(),
      });

      if (error) throw error;

      toast({
        title: "تم بنجاح",
        description: "تم إضافة ردك على التقييم",
      });

      setReplyText("");
      setReplyingTo(null);
      fetchReviews();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingReply(false);
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
            <span className="text-sm text-muted-foreground">
              ({reviews.length} تقييم)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Reviews Chart */}
          {reviews.length > 0 && (
            <ReviewsChart 
              reviews={reviews.map(r => ({ rating: r.rating }))}
              averageRating={averageRating}
              totalReviews={reviews.length}
            />
          )}
          {user && !hasUserReview && !isVendor && (
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

              <div>
                <label className="text-sm font-medium mb-2 block">إرفاق صورة (اختياري)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 5 * 1024 * 1024) {
                      toast({ title: "الملف كبير", description: "حجم الصورة يجب أن يكون أقل من 5 ميجا", variant: "destructive" });
                      return;
                    }
                    setImageFile(f);
                    setImagePreview(URL.createObjectURL(f));
                  }}
                />
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="معاينة" className="h-24 w-24 object-cover rounded-lg border" />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                      aria-label="إزالة الصورة"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Camera className="h-4 w-4 ml-1" /> اختيار صورة
                  </Button>
                )}
              </div>

              <Button type="submit" disabled={loading || rating === 0 || uploading}>
                {(loading || uploading) ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : null}
                {uploading ? "جاري رفع الصورة..." : "إضافة تقييم"}
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
                <div key={review.id} className="pb-4 border-b last:border-0">
                  <div className="flex gap-4">
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
                      {review.image_url && (
                        <a href={review.image_url} target="_blank" rel="noreferrer" className="block mt-2">
                          <img src={review.image_url} alt="صورة التقييم" className="h-32 w-32 object-cover rounded-lg border hover:opacity-90 transition-opacity" loading="lazy" />
                        </a>
                      )}

                      {/* Vendor Reply Section */}
                      {review.review_replies && review.review_replies.length > 0 && (
                        <div className="mt-3 mr-4 p-3 bg-muted/50 rounded-lg border-r-2 border-primary">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageCircle className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-primary">رد البائع</span>
                          </div>
                          <p className="text-sm text-foreground/80">
                            {review.review_replies[0].reply}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(review.review_replies[0].created_at), {
                              addSuffix: true,
                              locale: ar,
                            })}
                          </span>
                        </div>
                      )}

                      {/* Reply Form for Vendor */}
                      {isVendor && (!review.review_replies || review.review_replies.length === 0) && (
                        <div className="mt-3">
                          {replyingTo === review.id ? (
                            <div className="flex gap-2">
                              <Textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="اكتب ردك على هذا التقييم..."
                                rows={2}
                                className="flex-1"
                              />
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => handleReply(review.id)}
                                  disabled={submittingReply || !replyText.trim()}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyText("");
                                  }}
                                >
                                  إلغاء
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReplyingTo(review.id)}
                            >
                              <MessageCircle className="h-4 w-4 ml-1" />
                              الرد على التقييم
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
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
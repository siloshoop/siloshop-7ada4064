import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareQuote, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SectionHeader from "@/components/home/SectionHeader";

interface LatestReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  reviewer_name: string | null;
}

const LatestReviews = () => {
  const [reviews, setReviews] = useState<LatestReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await supabase.rpc(
          "latest_public_reviews" as never,
          { _limit: 8 } as never,
        );
        if (error) throw error;
        if (!cancelled) setReviews((data ?? []) as unknown as LatestReview[]);
      } catch (error) {
        console.error("LatestReviews error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && reviews.length === 0) return null;
  if (loading) return null;

  return (
    <section className="py-7 bg-muted/30">
      <div className="container px-4">
        <SectionHeader
          icon={MessageSquareQuote}
          eyebrow="آراء عملائنا"
          title="أحدث التقييمات"
          subtitle="تجارب حقيقية من مشترين على سيلو شوب"
          tone="success"
        />

        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {reviews.map((review) => (
            <Link
              key={review.id}
              to={`/product/${review.product_id}`}
              className="flex w-[260px] shrink-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                {review.product_image ? (
                  <img
                    src={review.product_image}
                    alt={review.product_name}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                    {review.product_name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-semibold">{review.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {review.reviewer_name || "مستخدم سيلو شوب"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${
                      i < review.rating ? "fill-accent text-accent" : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>

              {review.comment && (
                <p className="line-clamp-3 text-sm text-muted-foreground">{review.comment}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LatestReviews;

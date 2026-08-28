import { Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ReviewsChartProps {
  reviews: { rating: number }[];
  averageRating: number;
  totalReviews: number;
}

const ReviewsChart = ({ reviews, averageRating, totalReviews }: ReviewsChartProps) => {
  // Calculate rating distribution
  const ratingCounts = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => r.rating === rating).length,
    percentage: totalReviews > 0 
      ? (reviews.filter(r => r.rating === rating).length / totalReviews) * 100 
      : 0,
  }));

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "bg-success";
    if (rating === 3) return "bg-yellow-500";
    return "bg-destructive";
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 p-6 bg-muted/30 rounded-xl">
      {/* Average Rating Section */}
      <div className="flex flex-col items-center justify-center min-w-[150px]">
        <div className="text-6xl font-bold text-foreground">{averageRating.toFixed(1)}</div>
        <div className="flex items-center gap-1 my-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-5 w-5 ${
                star <= Math.round(averageRating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {totalReviews} تقييم
        </p>
      </div>

      {/* Rating Distribution */}
      <div className="flex-1 space-y-3">
        {ratingCounts.map(({ rating, count, percentage }) => (
          <div key={rating} className="flex items-center gap-3">
            <div className="flex items-center gap-1 w-12">
              <span className="text-sm font-medium">{rating}</span>
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            </div>
            
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${getRatingColor(rating)}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            
            <div className="w-12 text-left">
              <span className="text-sm text-muted-foreground">{count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReviewsChart;

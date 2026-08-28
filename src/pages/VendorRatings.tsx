import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Star, User, Calendar, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface VendorRating {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_id: string;
}

interface VendorProfile {
  full_name: string | null;
}

const VendorRatings = () => {
  const { vendorId } = useParams();
  const [ratings, setRatings] = useState<VendorRating[]>([]);
  const [vendorName, setVendorName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (vendorId) {
      fetchVendorData();
    }
  }, [vendorId]);

  const fetchVendorData = async () => {
    // Fetch vendor profile using secure function (excludes phone number)
    const { data: profiles } = await supabase
      .rpc("get_vendor_public_info", { vendor_id: vendorId });

    if (profiles && profiles.length > 0) {
      setVendorName(profiles[0].full_name || "بائع");
    }

    // Fetch all ratings
    const { data: ratingsData } = await supabase
      .from("vendor_ratings")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });

    if (ratingsData) {
      setRatings(ratingsData);
    }
    setLoading(false);
  };

  const averageRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
    : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: ratings.filter(r => r.rating === star).length,
    percentage: ratings.length > 0 
      ? (ratings.filter(r => r.rating === star).length / ratings.length) * 100 
      : 0,
  }));

  const StarDisplay = ({ rating }: { rating: number }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted"
          }`}
        />
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">تقييمات البائع: {vendorName}</h1>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Overall Rating */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">التقييم العام</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-5xl font-bold text-primary">
                  {averageRating.toFixed(1)}
                </div>
                <div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-6 w-6 ${
                          star <= Math.round(averageRating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {ratings.length} تقييم
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Ratings */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">إجمالي التقييمات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <TrendingUp className="h-10 w-10 text-primary" />
                <div>
                  <div className="text-4xl font-bold">{ratings.length}</div>
                  <p className="text-sm text-muted-foreground">تقييم</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Satisfaction Rate */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">نسبة الرضا</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="text-4xl font-bold text-success">
                  {ratings.length > 0
                    ? Math.round((ratings.filter(r => r.rating >= 4).length / ratings.length) * 100)
                    : 0}%
                </div>
                <p className="text-sm text-muted-foreground">
                  ({ratings.filter(r => r.rating >= 4).length} تقييم إيجابي)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rating Distribution */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>توزيع التقييمات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ratingDistribution.map(({ star, count, percentage }) => (
                <div key={star} className="flex items-center gap-4">
                  <div className="flex items-center gap-1 w-20">
                    <span className="font-medium">{star}</span>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  </div>
                  <Progress value={percentage} className="flex-1 h-3" />
                  <span className="text-sm text-muted-foreground w-16 text-left">
                    {count} ({percentage.toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* All Reviews */}
        <Card>
          <CardHeader>
            <CardTitle>جميع التقييمات ({ratings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {ratings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                لا توجد تقييمات بعد
              </p>
            ) : (
              <div className="space-y-4">
                {ratings.map((rating) => (
                  <div
                    key={rating.id}
                    className="border-b border-border pb-4 last:border-0"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <StarDisplay rating={rating.rating} />
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(rating.created_at), "dd MMM yyyy", {
                              locale: ar,
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    {rating.comment && (
                      <p className="mt-3 text-muted-foreground pr-12">
                        {rating.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default VendorRatings;
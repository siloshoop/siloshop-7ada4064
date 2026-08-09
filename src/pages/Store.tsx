import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Store as StoreIcon,
  Star,
  Users,
  Package,
  MessageSquare,
  ShieldCheck,
  MapPin,
  Calendar,
  Loader2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import ChatButton from "@/components/ChatButton";
import FollowStoreButton from "@/components/store/FollowStoreButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface StoreProfile {
  vendor_id: string;
  store_name: string;
  owner_name: string | null;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  city: string | null;
  governorate: string | null;
  avatar_url: string | null;
  rating: number;
  review_count: number;
  product_count: number;
  follower_count: number;
  is_verified: boolean;
  member_since: string;
}

interface StoreProduct {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  stock_quantity: number | null;
  shipping_cost: number | null;
  product_type: string | null;
  ships_within_days: number | null;
  reviews: { rating: number }[];
}

interface StoreReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

/** Public seller storefront: cover, logo, stats, products and seller reviews. */
const Store = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [followers, setFollowers] = useState(0);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [reviews, setReviews] = useState<StoreReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [profileRes, productsRes, reviewsRes] = await Promise.all([
        supabase.rpc("get_store_public_profile", { _vendor_id: vendorId }),
        supabase
          .from("products")
          .select(
            "id, name, price, original_price, image_url, stock_quantity, shipping_cost, product_type, ships_within_days, reviews(rating)",
          )
          .eq("vendor_id", vendorId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("vendor_ratings")
          .select("id, rating, comment, created_at")
          .eq("vendor_id", vendorId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (cancelled) return;
      const store = (profileRes.data as StoreProfile[] | null)?.[0] ?? null;
      setProfile(store);
      setFollowers(store?.follower_count ?? 0);
      setProducts((productsRes.data ?? []) as StoreProduct[]);
      setReviews((reviewsRes.data ?? []) as StoreReview[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const ratingBreakdown = useMemo(() => {
    return [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => r.rating === star).length,
    }));
  }, [reviews]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="container flex flex-1 items-center justify-center px-4 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="container flex-1 px-4 py-20 text-center">
          <StoreIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-xl font-bold">المتجر غير متوفر</h1>
          <p className="mt-2 text-muted-foreground">قد يكون المتجر غير مفعّل أو تم إيقافه.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const location = [profile.city, profile.governorate].filter(Boolean).join(" · ");
  const logo = profile.logo_url || profile.avatar_url;

  const stats = [
    { icon: Users, label: "متابع", value: followers.toLocaleString() },
    { icon: Star, label: "التقييم", value: profile.rating > 0 ? profile.rating.toFixed(1) : "—" },
    { icon: MessageSquare, label: "مراجعة", value: profile.review_count.toLocaleString() },
    { icon: Package, label: "منتج", value: profile.product_count.toLocaleString() },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 pb-10">
        {/* Cover */}
        <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-accent/25 md:h-60">
          {profile.cover_image_url && (
            <img
              src={profile.cover_image_url}
              alt={`غلاف متجر ${profile.store_name}`}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>

        <div className="container px-4">
          {/* Store header */}
          <div className="-mt-12 flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] md:-mt-16 md:flex-row md:items-center md:p-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-background md:h-24 md:w-24">
              {logo ? (
                <img src={logo} alt={`شعار ${profile.store_name}`} className="h-full w-full object-cover" />
              ) : (
                <StoreIcon className="h-9 w-9 text-primary" />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold md:text-2xl">{profile.store_name}</h1>
                {profile.is_verified && (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    بائع معتمد
                  </Badge>
                )}
              </div>
              {profile.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{profile.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  عضو منذ {format(new Date(profile.member_since), "MMMM yyyy", { locale: ar })}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <FollowStoreButton
                vendorId={profile.vendor_id}
                followerCount={followers}
                onCountChange={setFollowers}
              />
              <ChatButton vendorId={profile.vendor_id} />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map(({ icon: Icon, label, value }) => (
              <Card key={label} className="border-border/60">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-lg font-bold leading-none">{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="products" className="mt-6">
            <TabsList>
              <TabsTrigger value="products">المنتجات ({products.length})</TabsTrigger>
              <TabsTrigger value="reviews">التقييمات ({reviews.length})</TabsTrigger>
              <TabsTrigger value="about">عن المتجر</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-4">
              {products.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">لا توجد منتجات معروضة حالياً</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {products.map((product) => {
                    const ratings = product.reviews ?? [];
                    const avg = ratings.length
                      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
                      : 0;
                    const discount =
                      product.original_price && product.original_price > product.price
                        ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
                        : undefined;
                    return (
                      <ProductCard
                        key={product.id}
                        id={product.id}
                        name={product.name}
                        price={product.price}
                        originalPrice={product.original_price ?? undefined}
                        image={product.image_url || "/placeholder.svg"}
                        rating={avg}
                        reviews={ratings.length}
                        discount={discount}
                        shippingCost={product.shipping_cost ?? 0}
                        stockQuantity={product.stock_quantity}
                        storeName={profile.store_name}
                        productType={product.product_type}
                        shipsWithinDays={product.ships_within_days}
                      />
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reviews" className="mt-4 space-y-4">
              <Card>
                <CardContent className="grid gap-6 p-5 md:grid-cols-[auto,1fr]">
                  <div className="text-center">
                    <p className="text-4xl font-bold">{profile.rating > 0 ? profile.rating.toFixed(1) : "—"}</p>
                    <div className="mt-1 flex justify-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= Math.round(profile.rating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{profile.review_count} تقييم</p>
                  </div>
                  <div className="space-y-2">
                    {ratingBreakdown.map(({ star, count }) => (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-8 shrink-0">{star} ★</span>
                        <Progress
                          value={reviews.length ? (count / reviews.length) * 100 : 0}
                          className="h-2 flex-1"
                        />
                        <span className="w-8 shrink-0 text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {reviews.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">لا توجد تقييمات لهذا المتجر بعد</p>
              ) : (
                reviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="flex gap-3 p-4">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>م</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-3.5 w-3.5 ${
                                  star <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(review.created_at), "d MMMM yyyy", { locale: ar })}
                          </span>
                        </div>
                        {review.comment && <p className="mt-1 text-sm">{review.comment}</p>}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="about" className="mt-4">
              <Card>
                <CardContent className="space-y-3 p-5 text-sm">
                  <p className="text-muted-foreground">
                    {profile.description || "لم يضف البائع وصفاً لمتجره بعد."}
                  </p>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {profile.owner_name && (
                      <div className="flex justify-between rounded-lg border p-3">
                        <dt className="text-muted-foreground">صاحب المتجر</dt>
                        <dd className="font-medium">{profile.owner_name}</dd>
                      </div>
                    )}
                    {location && (
                      <div className="flex justify-between rounded-lg border p-3">
                        <dt className="text-muted-foreground">الموقع</dt>
                        <dd className="font-medium">{location}</dd>
                      </div>
                    )}
                    <div className="flex justify-between rounded-lg border p-3">
                      <dt className="text-muted-foreground">طريقة الدفع</dt>
                      <dd className="font-medium">الدفع عند الاستلام</dd>
                    </div>
                    <div className="flex justify-between rounded-lg border p-3">
                      <dt className="text-muted-foreground">سياسة الإرجاع</dt>
                      <dd className="font-medium">14 يوماً</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Store;
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/home/SectionHeader";
import { ProductGridSkeleton } from "@/components/skeletons/ProductSkeletons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { Truck, Banknote, Wallet, CreditCard, Package } from "lucide-react";

interface ProductRow {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  discount_price: number | null;
  image_url: string;
  stock_quantity: number | null;
  product_type: string | null;
  ships_within_days: number | null;
  shipping_duration_text: string | null;
  platform_free_shipping: boolean | null;
  platform_shipping_fee: number | null;
  reviews: { rating: number }[] | null;
}

interface PlatformOptions {
  cod_enabled: boolean;
  sham_cash_enabled: boolean;
  electronic_payment_enabled: boolean;
  free_shipping: boolean;
  shipping_fee: number;
}

const SELECT =
  "id, name, price, original_price, discount_price, image_url, stock_quantity, product_type, ships_within_days, shipping_duration_text, platform_free_shipping, platform_shipping_fee, reviews(rating)";

/** Dedicated marketplace section for Turkish (platform) products. */
const TurkishProducts = () => {
  const { isEnabled, loading: flagsLoading } = useFeatureFlags();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [options, setOptions] = useState<PlatformOptions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [{ data }, { data: opts }] = await Promise.all([
          supabase
            .from("products")
            .select(SELECT)
            .eq("product_type", "platform")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(60),
          supabase.rpc("get_platform_payment_options"),
        ]);
        if (cancelled) return;
        setProducts((data ?? []) as unknown as ProductRow[]);
        const o: any = Array.isArray(opts) ? opts[0] : opts;
        if (o) {
          setOptions({
            cod_enabled: !!o.cod_enabled,
            sham_cash_enabled: !!o.sham_cash_enabled,
            electronic_payment_enabled: !!o.electronic_payment_enabled,
            free_shipping: !!o.free_shipping,
            shipping_fee: Number(o.shipping_fee || 0),
          });
        }
      } catch (error) {
        console.error("TurkishProducts error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enabled = !flagsLoading && isEnabled("platform_marketplace");

  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title="المنتجات التركية | SiloShop"
        description="منتجات مستوردة من تركيا مع شحن وطرق دفع محددة من المنصة: الدفع عند الاستلام، شام كاش، والدفع الإلكتروني."
      />
      <Navbar />

      <main className="container px-4 py-6">
        <SectionHeader
          eyebrow="🇹🇷 المنتجات التركية"
          title="منتجات مستوردة من تركيا"
          subtitle="منتجات أصلية مختارة من المنصة، بشحن وطرق دفع محددة من إدارة المنصة."
          tone="accent"
        />

        {/* Shipping + payment terms for this section only */}
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-bold">
              <Truck className="h-4 w-4 text-primary" /> الشحن
            </p>
            <p className="text-sm text-muted-foreground">
              {!options
                ? "يتم تحديد تكلفة الشحن عند إتمام الشراء."
                : options.free_shipping
                  ? "شحن مجاني على منتجات هذا القسم."
                  : `تكلفة الشحن: ${options.shipping_fee.toLocaleString()} ل.س لكل طلب.`}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-bold">
              <Package className="h-4 w-4 text-primary" /> طرق الدفع المتاحة
            </p>
            <div className="flex flex-wrap gap-2">
              {options?.cod_enabled && (
                <Badge variant="secondary" className="gap-1">
                  <Banknote className="h-3.5 w-3.5" /> الدفع عند الاستلام
                </Badge>
              )}
              {options?.sham_cash_enabled && (
                <Badge variant="secondary" className="gap-1">
                  <Wallet className="h-3.5 w-3.5" /> شام كاش
                </Badge>
              )}
              {options?.electronic_payment_enabled && (
                <Badge variant="secondary" className="gap-1">
                  <CreditCard className="h-3.5 w-3.5" /> الدفع الإلكتروني
                </Badge>
              )}
              {options &&
                !options.cod_enabled &&
                !options.sham_cash_enabled &&
                !options.electronic_payment_enabled && (
                  <p className="text-sm text-muted-foreground">
                    لا توجد طريقة دفع مفعّلة حالياً لهذا القسم.
                  </p>
                )}
            </div>
          </div>
        </div>

        {loading || flagsLoading ? (
          <ProductGridSkeleton />
        ) : !enabled ? (
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
            <p className="font-bold">القسم غير متاح حالياً</p>
            <p className="mt-1 text-sm text-muted-foreground">
              سيتم تفعيل قسم المنتجات التركية قريباً.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/">العودة للرئيسية</Link>
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
            <p className="font-bold">لا توجد منتجات في هذا القسم بعد</p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/search">تصفح كل المنتجات</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product) => {
              const effectivePrice = product.discount_price ?? product.price;
              const base = product.original_price ?? undefined;
              const ratings = product.reviews ?? [];
              const avg =
                ratings.length > 0
                  ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
                  : 0;
              return (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={effectivePrice}
                  originalPrice={base && base > effectivePrice ? base : undefined}
                  image={product.image_url}
                  rating={avg}
                  reviews={ratings.length}
                  shippingCost={
                    (product.platform_free_shipping ?? options?.free_shipping)
                      ? 0
                      : product.platform_free_shipping == null
                        ? options?.shipping_fee
                        : Number(product.platform_shipping_fee || 0)
                  }
                  stockQuantity={product.stock_quantity}
                  productType={product.product_type}
                  shipsWithinDays={product.ships_within_days}
                  discount={
                    base && base > effectivePrice
                      ? Math.round(((base - effectivePrice) / base) * 100)
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default TurkishProducts;

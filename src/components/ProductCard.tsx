import { Heart, Star, Scale, ShoppingCart, Eye, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/FavoriteButton";
import ProductOriginBadge from "@/components/product/ProductOriginBadge";
import { useToast } from "@/hooks/use-toast";
import { useCompareProducts } from "@/hooks/useCompareProducts";
import { useFlyToCart } from "@/components/FlyToCart";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import React, { useState, memo } from "react";

interface ProductCardProps {
  id?: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  reviews: number;
  discount?: number;
  shippingCost?: number;
  stockQuantity?: number | null;
  /** Store (seller) display name */
  storeName?: string | null;
  /** "seller" (local) or "platform" (imported) */
  productType?: string | null;
  /** Preparation/shipping window in days */
  shipsWithinDays?: number | null;
  /** Units sold (aggregated) */
  soldCount?: number | null;
}


const ProductCard = memo(({
  id,
  name,
  price,
  originalPrice,
  image,
  rating,
  reviews,
  discount,
  shippingCost,
  stockQuantity,
  storeName,
  productType,
  shipsWithinDays,
}: ProductCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { addProduct } = useCompareProducts();
  const { triggerFly } = useFlyToCart();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const productId = id;

  const goToProduct = () => {
    if (!productId) return;
    navigate(`/product/${productId}`);
  };

  const handleCompare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!id) return;

    const result = await addProduct(id);

    if (result.message === "auth") {
      toast({
        title: "تسجيل الدخول مطلوب",
        description: "سجّل الدخول لحفظ قائمة المقارنة في حسابك",
        variant: "destructive",
      });
      return;
    }

    if (result.message === "exists") {
      toast({
        title: "موجود بالفعل",
        description: "هذا المنتج موجود في قائمة المقارنة",
      });
      return;
    }

    if (result.message === "max") {
      toast({
        title: "الحد الأقصى",
        description: "يمكنك مقارنة 4 منتجات كحد أقصى",
        variant: "destructive",
      });
      return;
    }

    if (!result.success) {
      toast({
        title: "تعذر الإضافة",
        description: "حدث خطأ أثناء إضافة المنتج للمقارنة",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "تمت الإضافة",
      description: "تم إضافة المنتج لقائمة المقارنة",
    });
  };


  const isOutOfStock = typeof stockQuantity === "number" && stockQuantity <= 0;
  const isLowStock = typeof stockQuantity === "number" && stockQuantity > 0 && stockQuantity <= 5;

  const handleAddToCart = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();

    const buttonRect = e.currentTarget.getBoundingClientRect();

    if (isOutOfStock) {
      toast({
        title: "نفذت الكمية",
        description: "هذا المنتج غير متوفر حالياً",
        variant: "destructive",
      });
      return;
    }

    if (!productId) return;

    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      const { data: existingItem } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();

      if (existingItem) {
        await supabase
          .from("cart_items")
          .update({ quantity: existingItem.quantity + 1 })
          .eq("id", existingItem.id);
      } else {
        await supabase.from("cart_items").insert({
          user_id: user.id,
          product_id: productId,
          quantity: 1,
        });
      }

      triggerFly(buttonRect.left + buttonRect.width / 2, buttonRect.top, image);

      toast({
        title: "تمت الإضافة",
        description: "تم إضافة المنتج إلى السلة",
      });
    } catch (error) {
      console.error("Cart error:", error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة المنتج للسلة",
        variant: "destructive",
      });
    }
  };

  const filledStars = Math.floor(rating);

  return (
    <div
      className="group relative cursor-pointer rounded-xl overflow-hidden bg-card border border-border/40 hover:border-primary/40 transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.25)] active:scale-[0.98]"
      onClick={goToProduct}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative aspect-square overflow-hidden bg-muted/30">
        {discount && (
          <div className="absolute top-2 left-2 z-10">
            <Badge className="bg-sale text-sale-foreground font-bold text-[10px] px-1.5 py-0.5 rounded-md shadow-lg backdrop-blur-sm border-0">
              {discount}%-
            </Badge>
          </div>
        )}

        {isOutOfStock && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
            <Badge className="bg-destructive text-destructive-foreground font-bold text-sm px-3 py-1 rounded-md shadow-lg border-0 animate-pop-in">
              نفذت الكمية
            </Badge>
          </div>
        )}
        {!isOutOfStock && isLowStock && (
          <div className="absolute bottom-2 left-2 z-10">
            <Badge className="bg-warning text-warning-foreground font-semibold text-[10px] px-1.5 py-0.5 rounded-md shadow-md border-0 animate-pulse">
              متبقي {stockQuantity}
            </Badge>
          </div>
        )}

        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          {id ? (
            <FavoriteButton productId={id} variant="ghost" size="icon" />
          ) : (
            <button
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-md shadow-sm hover:bg-primary hover:text-primary-foreground transition-all duration-300 hover:scale-110"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <Heart className="h-3.5 w-3.5" />
            </button>
          )}
          {id && (
            <button
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-md shadow-sm hover:bg-primary hover:text-primary-foreground transition-all duration-300 hover:scale-110 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
              onClick={handleCompare}
              title="أضف للمقارنة"
            >
              <Scale className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <img
          src={image}
          alt={name}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          className={`object-cover w-full h-full transition-all duration-700 ease-out ${
            imageLoaded ? "opacity-100" : "opacity-0"
          } ${isHovered ? "scale-110" : "scale-100"}`}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />

        <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-400 ease-out">
          <button
            className="w-full flex items-center justify-center gap-1.5 bg-background/90 backdrop-blur-md text-foreground py-2 rounded-lg text-xs font-semibold shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
            onClick={(e) => {
              e.stopPropagation();
              goToProduct();
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            عرض سريع
          </button>
        </div>
      </div>

      <div className="p-3 space-y-1.5">
        <h3 className="font-semibold text-xs leading-snug line-clamp-2 min-h-[2rem] text-foreground group-hover:text-primary transition-colors duration-300">
          {name}
        </h3>

        {/* Store name */}
        {storeName && (
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
            <Store className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{storeName}</span>
          </p>
        )}

        {/* Local seller / imported-from-Turkey badge */}
        <ProductOriginBadge productType={productType} compact />

        <div className="flex items-center gap-1">
          <div className="flex text-amber-400">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-2.5 w-2.5 ${i < filledStars ? "fill-current" : "text-muted"}`}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {rating > 0 ? rating.toFixed(1) : "—"} ({reviews} تقييم)
          </span>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-primary">
            {price.toLocaleString()} ل.س
          </span>
          {originalPrice && originalPrice > price && (
            <span className="text-[10px] text-muted-foreground line-through">
              {originalPrice.toLocaleString()} ل.س
            </span>
          )}
        </div>

        <div className="text-[10px] flex items-center gap-1">
          {shippingCost !== undefined ? (
            shippingCost > 0 ? (
              <span className="text-muted-foreground">🚚 شحن: {shippingCost.toLocaleString()} ل.س</span>
            ) : (
              <span className="text-green-600 dark:text-green-400 font-medium">🚚 شحن مجاني</span>
            )
          ) : (
            <span className="text-green-600 dark:text-green-400 font-medium">🚚 شحن مجاني</span>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground">
          {shipsWithinDays && shipsWithinDays > 0
            ? `التوصيل خلال ${shipsWithinDays} أيام`
            : productType === "platform"
            ? "التوصيل خلال 7-14 يوم"
            : "التوصيل خلال 1-3 أيام"}
        </p>

        <Button
          className="w-full rounded-lg font-semibold text-xs h-8 shadow-sm hover:shadow-md transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group/btn active:scale-95 disabled:opacity-60"
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          variant={isOutOfStock ? "secondary" : "default"}
        >
          <ShoppingCart className="h-3.5 w-3.5 ml-1.5 transition-transform duration-300 group-hover/btn:scale-110" />
          {isOutOfStock ? "نفذت الكمية" : "أضف للسلة"}
        </Button>
      </div>
    </div>
  );
});

ProductCard.displayName = "ProductCard";

export default ProductCard;

import { Heart, Star, Scale, ShoppingCart, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/FavoriteButton";
import { useToast } from "@/hooks/use-toast";
import { useCompareProducts } from "@/hooks/useCompareProducts";
import { useFlyToCart } from "@/components/FlyToCart";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

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
}

const ProductCard = ({
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
}: ProductCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { addProduct } = useCompareProducts();
  const { triggerFly } = useFlyToCart();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const productId = id || Math.random().toString(36).substr(2, 9);

  const handleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!id) return;
    
    const result = addProduct(id);
    
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

    // Capture button position before any async work (currentTarget becomes null after await)
    const buttonRect = e.currentTarget.getBoundingClientRect();

    if (isOutOfStock) {
      toast({
        title: "نفذت الكمية",
        description: "هذا المنتج غير متوفر حالياً",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      navigate("/auth");
      return;
    }

    if (!id) {
      toast({
        title: "خطأ",
        description: "لا يمكن إضافة هذا المنتج حالياً",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: existingItem, error: existingError } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("product_id", id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingItem) {
        const { error: updateError } = await supabase
          .from("cart_items")
          .update({ quantity: existingItem.quantity + 1 })
          .eq("id", existingItem.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("cart_items").insert({
          user_id: user.id,
          product_id: id,
          quantity: 1,
        });

        if (insertError) throw insertError;
      }

      triggerFly(buttonRect.left + buttonRect.width / 2, buttonRect.top, image);
      window.dispatchEvent(new Event("cart-updated"));

      toast({
        title: "تمت الإضافة",
        description: "تم إضافة المنتج إلى السلة",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل إضافة المنتج إلى السلة",
        variant: "destructive",
      });
    }
  };

  const filledStars = Math.floor(rating);

  return (
    <div
      className="group relative cursor-pointer rounded-xl overflow-hidden bg-card border border-border/40 hover:border-primary/40 transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.25)] active:scale-[0.98]"
      onClick={() => navigate(`/product/${productId}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-muted/30">
        {/* Discount Badge */}
        {discount && (
          <div className="absolute top-2 left-2 z-10">
            <Badge className="bg-sale text-sale-foreground font-bold text-[10px] px-1.5 py-0.5 rounded-md shadow-lg backdrop-blur-sm border-0">
              {discount}%-
            </Badge>
          </div>
        )}

        {/* Stock Badges */}
        {isOutOfStock && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
            <Badge className="bg-destructive text-destructive-foreground font-bold text-sm px-3 py-1 rounded-md shadow-lg border-0 animate-pop-in">
              نفذت الكمية
            </Badge>
          </div>
        )}
        {!isOutOfStock && isLowStock && (
          <div className="absolute bottom-2 left-2 z-10">
            <Badge className="bg-amber-500 text-white font-semibold text-[10px] px-1.5 py-0.5 rounded-md shadow-md border-0 animate-pulse">
              متبقي {stockQuantity}
            </Badge>
          </div>
        )}

        {/* Action Buttons */}
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

        {/* Image */}
        <img
          src={image}
          alt={name}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          className={`object-cover w-full h-full transition-all duration-700 ease-out ${
            imageLoaded ? "opacity-100" : "opacity-0"
          } ${isHovered ? "scale-110" : "scale-100"}`}
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />

        {/* Quick View Button */}
        <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-400 ease-out">
          <button
            className="w-full flex items-center justify-center gap-1.5 bg-background/90 backdrop-blur-md text-foreground py-2 rounded-lg text-xs font-semibold shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/product/${productId}`);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            عرض سريع
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-1.5">
        {/* Product Name */}
        <h3 className="font-semibold text-xs leading-snug line-clamp-2 min-h-[2rem] text-foreground group-hover:text-primary transition-colors duration-300">
          {name}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${
                  i < filledStars
                    ? "fill-amber-400 text-amber-400"
                    : "fill-muted text-muted"
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">({reviews})</span>
        </div>

        {/* Price */}
        <div className="flex items-end gap-1.5">
          <div className="flex items-baseline gap-0.5">
            <span className="font-bold text-base text-primary leading-none">
              {price.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">ل.س</span>
          </div>
          {originalPrice && (
            <span className="text-[10px] text-muted-foreground/70 line-through mr-auto">
              {originalPrice.toLocaleString()}
            </span>
          )}
        </div>

        {/* Shipping Cost */}
        <div className="text-[11px]">
          {shippingCost && shippingCost > 0 ? (
            <span className="text-muted-foreground">🚚 شحن: {shippingCost.toLocaleString()} ل.س</span>
          ) : (
            <span className="text-green-600 dark:text-green-400 font-medium">🚚 شحن مجاني</span>
          )}
        </div>

        {/* Add to Cart Button */}
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
};

export default ProductCard;

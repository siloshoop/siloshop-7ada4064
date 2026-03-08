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
}

const ProductCard = ({
  id,
  name,
  price,
  originalPrice,
  image,
  rating,
  reviews,
  discount
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

  const handleAddToCart = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

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

      const rect = e.currentTarget.getBoundingClientRect();
      triggerFly(rect.left + rect.width / 2, rect.top, image);
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
      className="group relative cursor-pointer rounded-xl overflow-hidden bg-card border border-border/40 hover:border-primary/40 transition-all duration-500 hover:shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.25)]"
      onClick={() => navigate(`/product/${productId}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-muted/30">
        {/* Discount Badge */}
        {discount && (
          <div className="absolute top-3 left-3 z-10">
            <Badge className="bg-sale text-sale-foreground font-bold text-xs px-2.5 py-1 rounded-lg shadow-lg backdrop-blur-sm border-0">
              {discount}%-
            </Badge>
          </div>
        )}

        {/* Action Buttons */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
          {id ? (
            <FavoriteButton productId={id} variant="ghost" size="icon" />
          ) : (
            <button
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-md shadow-sm hover:bg-primary hover:text-primary-foreground transition-all duration-300 hover:scale-110 hover:shadow-md"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <Heart className="h-4 w-4" />
            </button>
          )}
          {id && (
            <button
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-md shadow-sm hover:bg-primary hover:text-primary-foreground transition-all duration-300 hover:scale-110 hover:shadow-md opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
              onClick={handleCompare}
              title="أضف للمقارنة"
            >
              <Scale className="h-4 w-4" />
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
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-400 ease-out">
          <button
            className="w-full flex items-center justify-center gap-2 bg-background/90 backdrop-blur-md text-foreground py-2.5 rounded-xl text-sm font-semibold shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors duration-200"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/product/${productId}`);
            }}
          >
            <Eye className="h-4 w-4" />
            عرض سريع
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-2.5">
        {/* Product Name */}
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 min-h-[2.5rem] text-foreground group-hover:text-primary transition-colors duration-300">
          {name}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${
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
        <div className="flex items-end gap-2 pt-0.5">
          <div className="flex items-baseline gap-1">
            <span className="font-bold text-xl text-primary leading-none">
              {price.toLocaleString()}
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">ل.س</span>
          </div>
          {originalPrice && (
            <span className="text-xs text-muted-foreground/70 line-through mr-auto">
              {originalPrice.toLocaleString()}
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        <Button
          className="w-full rounded-xl font-semibold text-sm h-10 shadow-sm hover:shadow-md transition-all duration-300 group/btn"
          onClick={handleAddToCart}
        >
          <ShoppingCart className="h-4 w-4 ml-2 transition-transform duration-300 group-hover/btn:scale-110" />
          أضف للسلة
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;

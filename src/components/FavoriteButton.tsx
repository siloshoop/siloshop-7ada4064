import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface FavoriteButtonProps {
  productId: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

export const FavoriteButton = ({ productId, variant = "outline", size = "lg" }: FavoriteButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bouncing, setBouncing] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkFavorite = async () => {
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();

      setIsFavorite(!!data);
    };

    checkFavorite();
  }, [user, productId]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    setBouncing(true);
    setTimeout(() => setBouncing(false), 600);
    setLoading(true);
    try {
      if (isFavorite) {
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);

        setIsFavorite(false);
        toast({
          title: "تمت الإزالة",
          description: "تم إزالة المنتج من المفضلة",
        });
      } else {
        await supabase
          .from("favorites")
          .insert({
            user_id: user.id,
            product_id: productId,
          });

        setIsFavorite(true);
        toast({
          title: "تمت الإضافة",
          description: "تم إضافة المنتج إلى المفضلة",
        });
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleFavorite}
      disabled={loading}
      className="relative bg-background/95 hover:bg-primary hover:text-primary-foreground backdrop-blur-sm shadow-md transition-all duration-300 hover:scale-110"
    >
      <Heart className={`h-4 w-4 dark:text-pink-400 transition-transform ${bouncing ? "animate-bounce-in" : ""} ${isFavorite ? "fill-red-500 text-destructive dark:fill-pink-400 dark:text-pink-400" : ""}`} />
    </Button>
  );
};

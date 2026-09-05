import { useCallback, useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { notifySync, useSyncListener } from "@/lib/uiSync";

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

  const checkFavorite = useCallback(async () => {
    if (!user) {
      setIsFavorite(false);
      return;
    }
    const { data } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .maybeSingle();

    setIsFavorite(!!data);
  }, [user, productId]);

  useEffect(() => {
    void checkFavorite();
  }, [checkFavorite]);

  // Any favorite change anywhere in the app refreshes this button instantly.
  useSyncListener(["favorites"], checkFavorite);

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
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        if (error) throw error;

        setIsFavorite(false);
        notifySync("favorites");
        toast({
          title: "تمت الإزالة",
          description: "تم إزالة المنتج من المفضلة",
        });
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({
            user_id: user.id,
            product_id: productId,
          });
        // A duplicate row means it is already a favorite - treat as success.
        if (error && (error as { code?: string }).code !== "23505") throw error;

        setIsFavorite(true);
        notifySync("favorites");
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
      <Heart className={`h-4 w-4 dark:text-pink-400 transition-transform ${bouncing ? "animate-bounce-in" : ""} ${isFavorite ? "fill-red-500 text-red-500 dark:fill-pink-400 dark:text-pink-400" : ""}`} />
    </Button>
  );
};

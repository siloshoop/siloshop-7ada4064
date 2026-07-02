import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface OrderItem {
  product_id: string;
  quantity: number;
}

interface ReorderButtonProps {
  orderId: string;
  userId: string;
  orderItems: OrderItem[];
}

const ReorderButton = ({ orderId, userId, orderItems }: ReorderButtonProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleReorder = async () => {
    if (!orderItems || orderItems.length === 0) {
      toast({
        title: "خطأ",
        description: "لا توجد منتجات لإعادة الطلب",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // First, clear existing cart
      await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", userId);

      // Add all items from the order to cart
      const cartItems = orderItems.map((item) => ({
        user_id: userId,
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      const { error } = await supabase
        .from("cart_items")
        .insert(cartItems);

      if (error) throw error;

      toast({
        title: "تمت الإضافة",
        description: "تمت إضافة جميع المنتجات إلى سلة التسوق",
      });

      navigate("/cart");
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إعادة الطلب",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleReorder}
      disabled={loading}
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      إعادة الطلب
    </Button>
  );
};

export default ReorderButton;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CartRecommendations from "@/components/CartRecommendations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Trash2, ShoppingCart, Loader2, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuantityDiscount {
  min_quantity: number;
  discount_percentage: number;
}

interface CartItem {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string;
    stock_quantity: number;
    category_id: string;
  };
}

interface CartItemWithDiscount extends CartItem {
  appliedDiscount: number;
  discountedPrice: number;
  savings: number;
}

const Cart = () => {
  const { user, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discounts, setDiscounts] = useState<Record<string, QuantityDiscount[]>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchCart = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("cart_items")
          .select(`
            id,
            quantity,
            product:products(id, name, price, image_url, stock_quantity, category_id)
          `)
          .eq("user_id", user.id);

        if (error) throw error;
        setCartItems(data as any || []);

        // Fetch quantity discounts for all products
        if (data && data.length > 0) {
          const productIds = data.map((item: any) => item.product.id);
          const { data: discountData } = await supabase
            .from("quantity_discounts")
            .select("product_id, min_quantity, discount_percentage")
            .in("product_id", productIds)
            .order("min_quantity", { ascending: true });

          if (discountData) {
            const discountMap: Record<string, QuantityDiscount[]> = {};
            discountData.forEach((d: any) => {
              if (!discountMap[d.product_id]) {
                discountMap[d.product_id] = [];
              }
              discountMap[d.product_id].push({
                min_quantity: d.min_quantity,
                discount_percentage: d.discount_percentage,
              });
            });
            setDiscounts(discountMap);
          }
        }
      } catch (error: any) {
        toast({
          title: "خطأ",
          description: "فشل في جلب عربة التسوق",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCart();
  }, [user, toast]);

  const getApplicableDiscount = (productId: string, quantity: number): number => {
    const productDiscounts = discounts[productId] || [];
    let maxDiscount = 0;

    for (const discount of productDiscounts) {
      if (quantity >= discount.min_quantity) {
        maxDiscount = Math.max(maxDiscount, discount.discount_percentage);
      }
    }

    return maxDiscount;
  };

  const getNextDiscountTier = (productId: string, quantity: number): QuantityDiscount | null => {
    const productDiscounts = discounts[productId] || [];
    
    for (const discount of productDiscounts) {
      if (quantity < discount.min_quantity) {
        return discount;
      }
    }
    
    return null;
  };

  const calculateItemsWithDiscounts = (): CartItemWithDiscount[] => {
    return cartItems.map(item => {
      const discount = getApplicableDiscount(item.product.id, item.quantity);
      const originalTotal = Number(item.product.price) * item.quantity;
      const discountAmount = (originalTotal * discount) / 100;
      const discountedTotal = originalTotal - discountAmount;

      return {
        ...item,
        appliedDiscount: discount,
        discountedPrice: discountedTotal,
        savings: discountAmount,
      };
    });
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    try {
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity: newQuantity })
        .eq("id", itemId);

      if (error) throw error;

      setCartItems(items =>
        items.map(item =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      );
      window.dispatchEvent(new Event("cart-updated"));
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل في تحديث الكمية",
        variant: "destructive",
      });
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      setCartItems(items => items.filter(item => item.id !== itemId));
      window.dispatchEvent(new Event("cart-updated"));

      toast({
        title: "تم الحذف",
        description: "تم حذف المنتج من السلة",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل في حذف المنتج",
        variant: "destructive",
      });
    }
  };

  const itemsWithDiscounts = calculateItemsWithDiscounts();
  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );
  const totalSavings = itemsWithDiscounts.reduce((sum, item) => sum + item.savings, 0);
  const total = subtotal - totalSavings;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="pt-6 text-center space-y-4">
              <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground" />
              <h2 className="text-2xl font-bold">سجل الدخول أولاً</h2>
              <p className="text-muted-foreground">
                يجب تسجيل الدخول لعرض عربة التسوق
              </p>
              <Button onClick={() => navigate("/auth")} className="w-full">
                تسجيل الدخول
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">عربة التسوق</h1>

        {cartItems.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground" />
              <h2 className="text-2xl font-bold">عربة التسوق فارغة</h2>
              <p className="text-muted-foreground">
                ابدأ بإضافة منتجات إلى عربة التسوق
              </p>
              <Button onClick={() => navigate("/")}>
                تصفح المنتجات
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {itemsWithDiscounts.map((item) => {
                const nextTier = getNextDiscountTier(item.product.id, item.quantity);
                
                return (
                  <Card key={item.id}>
                    <CardContent className="p-6">
                      <div className="flex gap-4">
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-bold text-lg">{item.product.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {item.product.price} ل.س للقطعة
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>

                          {/* Quantity discount badge */}
                          {item.appliedDiscount > 0 && (
                            <Badge className="bg-green-500 hover:bg-green-600">
                              <Percent className="h-3 w-3 ml-1" />
                              خصم {item.appliedDiscount}% على الكمية
                            </Badge>
                          )}

                          {/* Next discount tier info */}
                          {nextTier && (
                            <p className="text-xs text-muted-foreground">
                              🎁 اشتر {nextTier.min_quantity - item.quantity} إضافية واحصل على خصم {nextTier.discount_percentage}%
                            </p>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-12 text-center font-bold">
                                {item.quantity}
                              </span>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                disabled={item.quantity >= item.product.stock_quantity}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="text-left">
                              {item.appliedDiscount > 0 && (
                                <p className="text-sm text-muted-foreground line-through">
                                  {(Number(item.product.price) * item.quantity).toFixed(0)} ل.س
                                </p>
                              )}
                              <p className="font-bold text-lg text-primary">
                                {item.discountedPrice.toFixed(0)} ل.س
                              </p>
                              {item.appliedDiscount > 0 && (
                                <p className="text-xs text-green-600">
                                  وفرت {item.savings.toFixed(0)} ل.س
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-xl font-bold">ملخص الطلب</h2>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">المجموع الفرعي</span>
                      <span>{subtotal.toFixed(0)} ل.س</span>
                    </div>
                    
                    {totalSavings > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600 flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          خصم الكمية
                        </span>
                        <span className="text-green-600 font-medium">
                          -{totalSavings.toFixed(0)} ل.س
                        </span>
                      </div>
                    )}
                    
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-bold text-lg">
                        <span>المجموع</span>
                        <span className="text-primary">{total.toFixed(0)} ل.س</span>
                      </div>
                    </div>
                  </div>

                  {totalSavings > 0 && (
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                      <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                        🎉 لقد وفرت {totalSavings.toFixed(0)} ل.س بفضل خصومات الكمية!
                      </p>
                    </div>
                  )}

                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={() => navigate("/checkout")}
                  >
                    إتمام الشراء
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Smart Recommendations */}
        {cartItems.length > 0 && (
          <CartRecommendations
            cartProductIds={cartItems.map((item) => item.product.id)}
            cartCategoryIds={[...new Set(cartItems.map((item) => item.product.category_id).filter(Boolean))]}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Cart;

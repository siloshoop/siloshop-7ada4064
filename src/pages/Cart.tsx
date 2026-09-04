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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Minus, Plus, Trash2, ShoppingCart, Loader2, Percent, Tag, Truck, Receipt, X, CheckCircle2, MapPin, Pencil, Bookmark } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuantityDiscount {
  min_quantity: number;
  discount_percentage: number;
}

interface CartItem {
  id: string;
  quantity: number;
  variant_id?: string | null;
  variantLabel?: string;
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string;
    stock_quantity: number;
    category_id: string;
    shipping_cost?: number;
    shipping_duration_text?: string | null;
  };
}

const CART_SELECT = `
  id,
  quantity,
  variant_id,
  variant:product_variants(id, attributes, price, discount_price, stock_quantity),
  product:products(id, name, price, image_url, stock_quantity, category_id, shipping_cost, shipping_duration_text)
`;

/** Applies the chosen variant's own price and stock to the cart row. */
const withVariant = (rows: any[]): CartItem[] =>
  (rows || []).map((row: any) => {
    const v = row.variant;
    if (!v) return { ...row, variantLabel: undefined } as CartItem;
    const attrs = (v.attributes || {}) as Record<string, string>;
    const price = v.discount_price ?? v.price ?? row.product?.price;
    return {
      ...row,
      variantLabel: Object.values(attrs).filter(Boolean).join(" / "),
      product: {
        ...row.product,
        price: Number(price),
        stock_quantity: v.stock_quantity ?? 0,
      },
    } as CartItem;
  });


interface CartItemWithDiscount extends CartItem {
  appliedDiscount: number;
  discountedPrice: number;
  savings: number;
}

interface SavedItem {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string;
    stock_quantity: number;
  };
}

const Cart = () => {
  const { user, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discounts, setDiscounts] = useState<Record<string, QuantityDiscount[]>>({});
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [defaultAddress, setDefaultAddress] = useState<any>(null);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [processingSavedId, setProcessingSavedId] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
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
          .select(CART_SELECT)
          .eq("user_id", user.id);

        if (error) throw error;
        setCartItems(withVariant(data as any));


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
      } catch (error) {
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

  const fetchSavedItems = async () => {
    if (!user) {
      setSavedLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("saved_for_later")
        .select(`
          id,
          quantity,
          product:products(id, name, price, image_url, stock_quantity)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSavedItems((data as any) || []);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في جلب المنتجات المحفوظة",
        variant: "destructive",
      });
    } finally {
      setSavedLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedItems();
  }, [user]);

  useEffect(() => {
    const loadDefault = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("delivery_addresses")
        .select("id, label, recipient_name, city, street, phone")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .maybeSingle();
      setDefaultAddress(data);
    };
    void loadDefault();
  }, [user]);

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
    } catch (error) {
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
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في حذف المنتج",
        variant: "destructive",
      });
    }
  };

  const saveForLater = async (item: CartItem) => {
    if (!user) return;
    setSavingItemId(item.id);
    try {
      const { data: existing, error: fetchError } = await supabase
        .from("saved_for_later")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("product_id", item.product.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        const { error: updateError } = await supabase
          .from("saved_for_later")
          .update({ quantity: existing.quantity + item.quantity })
          .eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("saved_for_later").insert({
          user_id: user.id,
          product_id: item.product.id,
          quantity: item.quantity,
        });
        if (insertError) throw insertError;
      }

      const { error: deleteError } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", item.id);
      if (deleteError) throw deleteError;

      setCartItems(items => items.filter(i => i.id !== item.id));
      window.dispatchEvent(new Event("cart-updated"));
      await fetchSavedItems();

      toast({
        title: "تم الحفظ",
        description: "تم نقل المنتج إلى المحفوظات لوقت لاحق",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في حفظ المنتج لوقت لاحق",
        variant: "destructive",
      });
    } finally {
      setSavingItemId(null);
    }
  };

  const moveToCart = async (item: SavedItem) => {
    if (!user) return;
    setProcessingSavedId(item.id);
    try {
      const { data: existingCartItem, error: fetchError } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("product_id", item.product.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingCartItem) {
        const { error: updateError } = await supabase
          .from("cart_items")
          .update({ quantity: existingCartItem.quantity + item.quantity })
          .eq("id", existingCartItem.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("cart_items").insert({
          user_id: user.id,
          product_id: item.product.id,
          quantity: item.quantity,
        });
        if (insertError) throw insertError;
      }

      const { error: deleteError } = await supabase
        .from("saved_for_later")
        .delete()
        .eq("id", item.id);
      if (deleteError) throw deleteError;

      setSavedItems(items => items.filter(i => i.id !== item.id));

      const { data, error } = await supabase
        .from("cart_items")
        .select(CART_SELECT)
        .eq("user_id", user.id);
      if (error) throw error;
      setCartItems(withVariant(data as any));

      window.dispatchEvent(new Event("cart-updated"));

      toast({
        title: "تم النقل",
        description: "تم نقل المنتج إلى عربة التسوق",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في نقل المنتج إلى عربة التسوق",
        variant: "destructive",
      });
    } finally {
      setProcessingSavedId(null);
    }
  };

  const removeSaved = async (itemId: string) => {
    setProcessingSavedId(itemId);
    try {
      const { error } = await supabase
        .from("saved_for_later")
        .delete()
        .eq("id", itemId);
      if (error) throw error;

      setSavedItems(items => items.filter(i => i.id !== itemId));

      toast({
        title: "تم الحذف",
        description: "تم حذف المنتج من المحفوظات",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في حذف المنتج المحفوظ",
        variant: "destructive",
      });
    } finally {
      setProcessingSavedId(null);
    }
  };

  const itemsWithDiscounts = calculateItemsWithDiscounts();
  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );
  const totalSavings = itemsWithDiscounts.reduce((sum, item) => sum + item.savings, 0);
  const subtotalAfterQtyDiscount = subtotal - totalSavings;
  const shippingTotal = cartItems.reduce(
    (sum, item) => sum + Number(item.product.shipping_cost || 0) * item.quantity,
    0
  );
  const TAX_RATE = 0; // الضريبة (VAT) — غير مطبّقة حالياً
  const taxableBase = Math.max(0, subtotalAfterQtyDiscount - couponDiscount);
  const taxAmount = taxableBase * TAX_RATE;
  const total = taxableBase + shippingTotal + taxAmount;

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال كود الكوبون", variant: "destructive" });
      return;
    }
    setValidatingCoupon(true);
    try {
      const { data: rows, error } = await supabase.rpc("validate_coupon", {
        _code: couponCode.toUpperCase().trim(),
        _subtotal: subtotalAfterQtyDiscount,
      });
      if (error) throw error;
      const data = Array.isArray(rows) ? rows[0] : rows;
      if (!data) {
        toast({
          title: "كوبون غير صالح",
          description: "الكود غير صحيح أو منتهي الصلاحية أو لم يتحقق الحد الأدنى",
          variant: "destructive",
        });
        return;
      }
      const discountAmount = data.discount_type === "percentage"
        ? (subtotalAfterQtyDiscount * Number(data.discount_value)) / 100
        : Number(data.discount_value);
      setAppliedCoupon(data);
      setCouponDiscount(discountAmount);
      toast({ title: "تم التطبيق", description: `تم تطبيق خصم ${discountAmount.toFixed(0)} ل.س` });
    } catch (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponCode("");
  };

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
                        <img loading="lazy" decoding="async"
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
                              <p className="text-sm inline-flex items-center gap-1 mt-0.5">
                                <Truck className="h-3.5 w-3.5 text-primary" />
                                {Number(item.product.shipping_cost || 0) === 0
                                  ? "شحن مجاني"
                                  : `الشحن: ${Number(item.product.shipping_cost || 0).toLocaleString()} ل.س`}
                              </p>
                              {item.product.shipping_duration_text && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  مدة الشحن: {item.product.shipping_duration_text}
                                </p>
                              )}
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

                          <div className="flex items-center justify-between flex-wrap gap-2">
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

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => saveForLater(item)}
                            disabled={savingItemId === item.id}
                          >
                            {savingItemId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin ml-1" />
                            ) : (
                              <Bookmark className="h-4 w-4 ml-1" />
                            )}
                            حفظ لوقت لاحق
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardContent className="p-6 space-y-5">
                  <h2 className="text-xl font-bold">ملخص الطلب</h2>

                  {/* Delivery address */}
                  <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-primary" />
                        عنوان التوصيل
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => navigate("/account/addresses")}
                      >
                        <Pencil className="h-3 w-3 ml-1" />
                        {defaultAddress ? "تغيير" : "إضافة"}
                      </Button>
                    </div>
                    {defaultAddress ? (
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        <p className="font-semibold text-foreground">{defaultAddress.recipient_name}</p>
                        <p>{defaultAddress.city}</p>
                        <p dir="ltr">{defaultAddress.phone}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">لم يتم تحديد عنوان افتراضي. سيتم طلبه عند إتمام الطلب.</p>
                    )}
                  </div>

                  {/* Coupon section */}
                  <div className="space-y-2">
                    <Label htmlFor="cart-coupon" className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" />
                      كود الخصم
                    </Label>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between gap-2 rounded-md border border-green-500/40 bg-green-50 dark:bg-green-950/30 px-3 py-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
                          <CheckCircle2 className="h-4 w-4" />
                          <span dir="ltr">{appliedCoupon.code}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={removeCoupon}
                          aria-label="إزالة الكوبون"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          id="cart-coupon"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          placeholder="أدخل الكود"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              applyCoupon();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={applyCoupon}
                          disabled={validatingCoupon || !couponCode.trim()}
                        >
                          {validatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "تطبيق"}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Totals breakdown */}
                  <div className="space-y-2 border-t pt-4">
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

                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600 flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          خصم الكوبون
                        </span>
                        <span className="text-green-600 font-medium">
                          -{couponDiscount.toFixed(0)} ل.س
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5" />
                        تكلفة التوصيل
                      </span>
                      <span className={shippingTotal === 0 ? "text-green-600 font-medium" : ""}>
                        {shippingTotal === 0 ? "مجاني" : `${shippingTotal.toFixed(0)} ل.س`}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Receipt className="h-3.5 w-3.5" />
                        الضريبة {TAX_RATE > 0 ? `(${(TAX_RATE * 100).toFixed(0)}%)` : ""}
                      </span>
                      <span>{taxAmount.toFixed(0)} ل.س</span>
                    </div>

                    <div className="border-t pt-3 mt-2">
                      <div className="flex justify-between font-bold text-lg">
                        <span>الإجمالي النهائي</span>
                        <span className="text-primary">{total.toFixed(0)} ل.س</span>
                      </div>
                    </div>
                  </div>

                  {(totalSavings > 0 || couponDiscount > 0) && (
                    <div className="bg-green-50 dark:bg-green-950/40 p-3 rounded-lg">
                      <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                        🎉 لقد وفرت {(totalSavings + couponDiscount).toFixed(0)} ل.س على هذا الطلب!
                      </p>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() =>
                      navigate("/checkout", {
                        state: appliedCoupon
                          ? { couponCode: appliedCoupon.code, couponDiscount }
                          : undefined,
                      })
                    }
                  >
                    <ShoppingCart className="ml-2 h-5 w-5" />
                    إتمام الطلب
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    الدفع آمن ومحمي. يمكنك مراجعة الطلب قبل التأكيد.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Saved for later */}
        {savedItems.length > 0 && (
          <div className="mt-10 space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-primary" />
              محفوظ لوقت لاحق
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <img loading="lazy" decoding="async"
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-20 h-20 object-cover rounded-lg shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="font-bold truncate">{item.product.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.product.price} ل.س للقطعة
                        </p>
                        <p className="text-xs text-muted-foreground">
                          الكمية: {item.quantity}
                        </p>
                        {item.product.stock_quantity <= 0 && (
                          <Badge variant="destructive">غير متوفر</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => moveToCart(item)}
                        disabled={processingSavedId === item.id || item.product.stock_quantity <= 0}
                      >
                        {processingSavedId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin ml-1" />
                        ) : (
                          <ShoppingCart className="h-4 w-4 ml-1" />
                        )}
                        نقل إلى السلة
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeSaved(item.id)}
                        disabled={processingSavedId === item.id}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                        إزالة
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
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

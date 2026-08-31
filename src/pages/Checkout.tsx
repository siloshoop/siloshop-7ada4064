import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShoppingCart, Tag, MapPin, Plus, Truck, Wallet, Banknote, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SYRIAN_GOVERNORATES } from "@/lib/syrianGovernorates";
import ReturnsPolicyNote from "@/components/ReturnsPolicyNote";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

const checkoutSchema = z.object({
  phone: z.string()
    .min(1, "رقم الهاتف مطلوب")
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^09\d{8}$/, "رقم الهاتف يجب أن يكون بصيغة 09xxxxxxxx")),
  governorate: z.string()
    .min(1, "يرجى اختيار المحافظة")
    .refine((v) => (SYRIAN_GOVERNORATES as readonly string[]).includes(v), "يرجى اختيار محافظة صحيحة"),
  area: z.string().trim().min(2, "يرجى إدخال المدينة أو المنطقة").max(100, "المنطقة طويلة جداً"),
  street: z.string().trim().min(5, "يرجى إدخال الشارع وأقرب علامة مميزة").max(200, "العنوان طويل جداً"),
  notes: z.string().max(1000, "الملاحظات طويلة جداً").optional(),
});

const composeAddress = (f: { governorate: string; area: string; street: string }) =>
  [f.governorate, f.area.trim(), f.street.trim()].filter(Boolean).join("، ");


interface CartItem {
  id: string;
  quantity: number;
  product_id: string;
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string;
    vendor_id: string;
    shipping_cost?: number;
    product_type?: string;
    shipping_duration_text?: string | null;
  };
}

interface PlatformPaymentSettings {
  sham_cash_account_name: string;
  sham_cash_account_number: string;
  instructions: string;
  is_active: boolean;
}

const Checkout = () => {
  const { user, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [discount, setDiscount] = useState(0);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [shamSettings, setShamSettings] = useState<PlatformPaymentSettings | null>(null);
  const [platformOptions, setPlatformOptions] = useState<{ sham_cash_enabled: boolean; cod_enabled: boolean } | null>(null);
  const [selectedPlatformMethod, setSelectedPlatformMethod] = useState<"sham_cash" | "cod" | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isEnabled } = useFeatureFlags();

  const [formData, setFormData] = useState({
    phone: "",
    governorate: "",
    area: "",
    street: "",
    notes: "",
  });


  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchCart();
  }, [user]);

  useEffect(() => {
    const loadAddresses = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("delivery_addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });
      const addrs = data || [];
      setSavedAddresses(addrs);
      const def = addrs.find((a: any) => a.is_default) || addrs[0];
      if (def) {
        setSelectedAddressId(def.id);
        setFormData((f) => ({
          ...f,
          phone: def.phone || f.phone,
          governorate: def.governorate || def.city || f.governorate,
          area: def.city || f.area,
          street: [def.street, def.building, def.apartment, def.landmark].filter(Boolean).join(" - ") || f.street,
        }));
      }

    };
    void loadAddresses();
  }, [user]);

  const fetchCart = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("cart_items")
        .select(`
          id,
          quantity,
          product_id,
          product:products(id, name, price, image_url, vendor_id, shipping_cost, product_type, shipping_duration_text)
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      setCartItems(data as any || []);
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

  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );

  const shippingTotal = cartItems.reduce(
    (sum, item) => sum + Number((item.product as any).shipping_cost || 0),
    0
  );

  const total = subtotal + shippingTotal - discount;

  // Payment model (enforced server-side in create_order):
  //  - Seller products  -> Cash on Delivery ONLY.
  //  - Platform products -> only the methods the platform owner enabled
  //    (Sham Cash / Cash on Delivery), validated again inside create_order.
  const hasPlatformItems = cartItems.some((i) => i.product.product_type === "platform");
  const hasSellerItems = cartItems.some((i) => i.product.product_type !== "platform");
  const isMixedCart = hasPlatformItems && hasSellerItems;
  const platformEnabled = isEnabled("platform_marketplace");
  const platformShamAvailable = !!platformOptions?.sham_cash_enabled;
  const platformCodAvailable = !!platformOptions?.cod_enabled;
  const platformHasMethod = platformShamAvailable || platformCodAvailable;
  const platformBlocked = hasPlatformItems && (!platformEnabled || !platformHasMethod);
  const paymentMethod: "sham_cash" | "cod" =
    hasPlatformItems && !isMixedCart && platformEnabled
      ? (selectedPlatformMethod ?? (platformShamAvailable ? "sham_cash" : "cod"))
      : "cod";

  useEffect(() => {
    if (!hasPlatformItems) return;
    void (async () => {
      const { data } = await supabase.rpc("get_platform_payment_options");
      const opts = Array.isArray(data) ? data[0] : (data as any);
      if (opts) {
        setPlatformOptions({
          sham_cash_enabled: !!opts.sham_cash_enabled,
          cod_enabled: !!opts.cod_enabled,
        });
        setSelectedPlatformMethod((cur) => {
          if (cur === "sham_cash" && opts.sham_cash_enabled) return cur;
          if (cur === "cod" && opts.cod_enabled) return cur;
          return opts.sham_cash_enabled ? "sham_cash" : opts.cod_enabled ? "cod" : null;
        });
      }
    })();
  }, [hasPlatformItems]);

  useEffect(() => {
    if (!hasPlatformItems || !platformShamAvailable) return;
    void (async () => {
      const { data } = await supabase
        .from("platform_payment_settings")
        .select("sham_cash_account_name, sham_cash_account_number, instructions, is_active")
        .eq("id", 1)
        .maybeSingle();
      if (data) setShamSettings(data as PlatformPaymentSettings);
    })();
  }, [hasPlatformItems, platformShamAvailable]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال كود الكوبون",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: rows, error } = await supabase
        .rpc("validate_coupon", {
          _code: couponCode.toUpperCase(),
          _subtotal: subtotal,
        });

      if (error) throw error;

      const data = Array.isArray(rows) ? rows[0] : rows;

      if (!data) {
        toast({
          title: "خطأ",
          description: "كود الكوبون غير صحيح أو منتهي الصلاحية أو الحد الأدنى للشراء غير محقق",
          variant: "destructive",
        });
        return;
      }

      // Calculate discount
      let discountAmount = 0;
      if (data.discount_type === 'percentage') {
        discountAmount = (subtotal * data.discount_value) / 100;
      } else {
        discountAmount = data.discount_value;
      }

      setAppliedCoupon(data);
      setDiscount(discountAmount);

      toast({
        title: "تم التطبيق",
        description: `تم تطبيق كوبون خصم بقيمة ${discountAmount} ل.س`,
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || cartItems.length === 0) return;

    if (isMixedCart) {
      toast({
        title: "لا يمكن إتمام الطلب",
        description:
          "منتجات المنصة تُدفع عبر شام كاش ومنتجات البائعين تُدفع عند الاستلام. يرجى إتمام كل نوع في طلب منفصل.",
        variant: "destructive",
      });
      return;
    }

    // Validate form data with zod schema
    const validationResult = checkoutSchema.safeParse(formData);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      toast({
        title: "خطأ في البيانات",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Create order server-side via SECURITY DEFINER RPC.
      // Total, prices, shipping, and coupon redemption are computed from
      // the database — the client cannot tamper with total_amount.
      const fullAddress = composeAddress(formData);
      const { data: newOrderId, error: orderError } = await supabase.rpc("create_order", {
        _items: cartItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        _phone: formData.phone,
        _shipping_address: fullAddress,
        _notes: formData.notes || null,
        _coupon_code: appliedCoupon?.code || null,
        _payment_method: paymentMethod,
      });

      if (orderError) throw orderError;
      const order = { id: newOrderId as string };

      // Get customer profile for name
      const { data: customerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const customerName = customerProfile?.full_name || "عميل";

      // Group items by vendor and notify each vendor
      const itemsByVendor = cartItems.reduce((acc, item) => {
        const vendorId = item.product.vendor_id;
        if (!acc[vendorId]) {
          acc[vendorId] = [];
        }
        acc[vendorId].push({
          product_name: item.product.name,
          quantity: item.quantity,
          price: Number(item.product.price) * item.quantity,
        });
        return acc;
      }, {} as Record<string, Array<{ product_name: string; quantity: number; price: number }>>);

      // Notify each vendor about their items
      for (const [vendorId, vendorItems] of Object.entries(itemsByVendor)) {
        const vendorTotal = vendorItems.reduce((sum, item) => sum + item.price, 0);
        try {
          await supabase.functions.invoke("notify-vendor-new-order", {
            body: {
              order_id: order.id,
              vendor_id: vendorId,
              customer_name: customerName,
              items: vendorItems,
              total_amount: vendorTotal,
              shipping_address: formData.shipping_address,
            },
          });
        } catch (notifyError) {
          console.error("Failed to notify vendor:", notifyError);
        }
      }

      // Coupon redemption + cart clearing handled atomically inside create_order RPC.

      toast({
        title: "تم إنشاء الطلب",
        description:
          paymentMethod === "sham_cash"
            ? "يرجى تحويل المبلغ إلى حساب شام كاش الخاص بالمنصة لتأكيد الطلب."
            : "الدفع عند الاستلام. يمكنك تتبع طلبك من صفحة طلباتي.",
      });

      // Payment record is created automatically by create_order with the
      // method enforced server-side. Send the customer straight to their orders.
      navigate("/orders");
    } catch (error) {
      const message = String(error?.message || "");
      if (message.includes("PLATFORM_MARKETPLACE_DISABLED") || message.includes("SHAM_CASH_DISABLED")) {
        toast({
          title: "غير متاح حالياً",
          description: "منتجات المنصة المستوردة غير متاحة للشراء بعد. يرجى إزالتها من السلة.",
          variant: "destructive",
        });
        return;
      }
      if (message.includes("PAYMENT_METHOD_UNAVAILABLE")) {
        toast({
          title: "طريقة الدفع غير متاحة",
          description: "طريقة الدفع المختارة غير مفعّلة لمنتجات المنصة. يرجى اختيار طريقة أخرى.",
          variant: "destructive",
        });
        return;
      }
      if (message.includes("MIXED_CART")) {
        toast({
          title: "لا يمكن إتمام الطلب",
          description: "لا يمكن دمج منتجات المنصة مع منتجات البائعين في طلب واحد.",
          variant: "destructive",
        });
        return;
      }
      if (message.includes("OUT_OF_STOCK")) {
        const name = message.split("OUT_OF_STOCK:")[1]?.split("\n")[0]?.trim();
        toast({
          title: "الكمية غير متوفرة",
          description: name
            ? `الكمية المطلوبة من "${name}" غير متوفرة حالياً. يرجى تعديل الكمية.`
            : "أحد المنتجات لم تعد كميته متوفرة. يرجى تحديث السلة.",
          variant: "destructive",
        });
        return;
      }
      if (message.includes("ORDER_RATE_LIMIT")) {
        toast({
          title: "تم تجاوز الحد المسموح",
          description: "يمكنك إنشاء 5 طلبات كحد أقصى في الساعة. يرجى المحاولة لاحقاً.",
          variant: "destructive",
        });
        return;
      }
      if (message.includes("TOO_MANY_OPEN_ORDERS")) {
        toast({
          title: "لديك طلبات قيد المعالجة",
          description: "يوجد 10 طلبات قيد المعالجة على حسابك. يرجى انتظار إتمامها قبل إنشاء طلب جديد.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
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

  // Declarative redirect: calling navigate() during render triggers a
  // "cannot update a component while rendering" React warning.
  if (cartItems.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">إتمام الطلب</h1>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>معلومات الشحن</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {savedAddresses.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> اختر عنواناً محفوظاً</Label>
                        <Link to="/account/addresses" className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Plus className="h-3 w-3" /> إدارة العناوين
                        </Link>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {savedAddresses.map((a) => (
                          <button
                            type="button"
                            key={a.id}
                            onClick={() => {
                              setSelectedAddressId(a.id);
                              setFormData({
                                ...formData,
                                phone: a.phone,
                                governorate: a.governorate || a.city || "",
                                area: a.city || "",
                                street: [a.street, a.building, a.apartment, a.landmark].filter(Boolean).join(" - "),
                              });
                            }}
                            className={`text-right p-3 rounded-lg border text-sm transition-colors ${selectedAddressId === a.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                          >
                            <p className="font-semibold">{a.recipient_name} {a.is_default && <span className="text-xs text-primary">(افتراضي)</span>}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{a.city}</p>
                            <p className="text-xs text-muted-foreground" dir="ltr">{a.phone}</p>
                          </button>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground text-center">— أو أدخل عنواناً جديداً —</div>
                    </div>
                  )}
                  {savedAddresses.length === 0 && (
                    <Link to="/account/addresses" className="text-xs text-primary hover:underline flex items-center gap-1 justify-end">
                      <Plus className="h-3 w-3" /> حفظ عناوين للاستخدام لاحقاً
                    </Link>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الهاتف *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      placeholder="مثال: 0912345678"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">المحافظة *</Label>
                    <Select
                      value={formData.governorate}
                      onValueChange={(v) => setFormData({ ...formData, governorate: v })}
                    >
                      <SelectTrigger id="address">
                        <SelectValue placeholder="اختر المحافظة" />
                      </SelectTrigger>
                      <SelectContent>
                        {SYRIAN_GOVERNORATES.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="area">المدينة / المنطقة *</Label>
                    <Input
                      id="area"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      required
                      placeholder="مثال: حماة - حي الأربعين"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="street">الشارع وأقرب علامة مميزة *</Label>
                    <Input
                      id="street"
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      required
                      placeholder="مثال: شارع القوتلي، بناء رقم 5، بجانب صيدلية النور"
                    />
                  </div>


                  <div className="space-y-2">
                    <Label htmlFor="notes">ملاحظات إضافية (اختياري)</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="أي ملاحظات للبائع"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>المنتجات</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex gap-4">
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium">{item.product.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            الكمية: {item.quantity}
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
                        <div className="text-left">
                          <p className="font-bold">
                            {Number(item.product.price) * item.quantity} ل.س
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-20">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-2xl font-bold">ملخص الطلب</h2>

                  <div className="space-y-2">
                    <Label htmlFor="coupon">كود الخصم</Label>
                    <div className="flex gap-2">
                      <Input
                        id="coupon"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="أدخل الكود"
                        disabled={!!appliedCoupon}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={applyCoupon}
                        disabled={!!appliedCoupon}
                      >
                        <Tag className="h-4 w-4" />
                      </Button>
                    </div>
                    {appliedCoupon && (
                      <p className="text-sm text-green-600">
                        ✓ تم تطبيق الكوبون: {appliedCoupon.code}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex justify-between">
                      <span>المجموع الفرعي</span>
                      <span>{subtotal} ل.س</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>الخصم</span>
                        <span>-{discount} ل.س</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>الشحن</span>
                      <span>{shippingTotal > 0 ? `${shippingTotal} ل.س` : 'مجاني'}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold text-lg">
                      <span>الإجمالي</span>
                      <span className="text-primary">{total} ل.س</span>
                    </div>
                  </div>

                  {platformBlocked ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-1">
                      <p className="font-semibold flex items-center gap-1.5 text-destructive">
                        <AlertTriangle className="h-4 w-4" /> غير متاح حالياً
                      </p>
                      <p className="text-muted-foreground">
                        منتجات المنصة (المستوردة) غير متاحة للشراء في الوقت الحالي. يرجى إزالتها من
                        السلة ومتابعة الشراء من منتجات البائعين المحليين.
                      </p>
                    </div>
                  ) : isMixedCart ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-1">
                      <p className="font-semibold flex items-center gap-1.5 text-destructive">
                        <AlertTriangle className="h-4 w-4" /> طلب مختلط
                      </p>
                      <p className="text-muted-foreground">
                        سلتك تحتوي منتجات المنصة (شام كاش) ومنتجات بائعين (الدفع عند الاستلام). يرجى
                        إتمام كل نوع في طلب منفصل.
                      </p>
                    </div>
                  ) : hasPlatformItems && platformShamAvailable && platformCodAvailable ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm space-y-2">
                      <p className="font-semibold">اختر طريقة الدفع</p>
                      <div className="grid gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPlatformMethod("sham_cash")}
                          className={`text-right p-2.5 rounded-lg border transition-colors ${paymentMethod === "sham_cash" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                        >
                          <span className="font-semibold inline-flex items-center gap-1.5">
                            <Wallet className="h-4 w-4" /> شام كاش
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPlatformMethod("cod")}
                          className={`text-right p-2.5 rounded-lg border transition-colors ${paymentMethod === "cod" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                        >
                          <span className="font-semibold inline-flex items-center gap-1.5">
                            <Banknote className="h-4 w-4" /> الدفع عند الاستلام
                          </span>
                        </button>
                      </div>
                      {paymentMethod === "sham_cash" && shamSettings?.sham_cash_account_number && (
                        <div className="pt-1 space-y-0.5">
                          {shamSettings.sham_cash_account_name && (
                            <p>اسم الحساب: <span className="font-semibold">{shamSettings.sham_cash_account_name}</span></p>
                          )}
                          <p>
                            رقم المحفظة:{" "}
                            <span className="font-semibold" dir="ltr">{shamSettings.sham_cash_account_number}</span>
                          </p>
                          {shamSettings.instructions && (
                            <p className="text-muted-foreground">{shamSettings.instructions}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : paymentMethod === "sham_cash" ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm space-y-1">
                      <p className="font-semibold flex items-center gap-1.5">
                        <Wallet className="h-4 w-4" /> طريقة الدفع: شام كاش
                      </p>
                      <p className="text-muted-foreground">
                        منتجات المنصة تُدفع عبر شام كاش إلى حساب المنصة فقط.
                      </p>
                      {shamSettings?.sham_cash_account_number ? (
                        <div className="pt-1 space-y-0.5">
                          {shamSettings.sham_cash_account_name && (
                            <p>اسم الحساب: <span className="font-semibold">{shamSettings.sham_cash_account_name}</span></p>
                          )}
                          <p>
                            رقم المحفظة:{" "}
                            <span className="font-semibold" dir="ltr">{shamSettings.sham_cash_account_number}</span>
                          </p>
                          {shamSettings.instructions && (
                            <p className="text-muted-foreground">{shamSettings.instructions}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          سيتم تزويدك بتفاصيل حساب شام كاش بعد تأكيد الطلب.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                      <p className="font-semibold flex items-center gap-1.5">
                        <Banknote className="h-4 w-4" /> طريقة الدفع: الدفع عند الاستلام (COD)
                      </p>
                      <p className="text-muted-foreground">منتجات البائعين تُدفع نقداً عند الاستلام.</p>
                    </div>
                  )}

                  <ReturnsPolicyNote />

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={submitting || isMixedCart || platformBlocked}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                        جاري المعالجة...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="ml-2 h-5 w-5" />
                        تأكيد الطلب
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;

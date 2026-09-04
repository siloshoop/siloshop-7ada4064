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
import { Loader2, ShoppingCart, Tag, MapPin, Plus, Truck, Wallet, Banknote, AlertTriangle, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SYRIAN_GOVERNORATES } from "@/lib/syrianGovernorates";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";


const checkoutSchema = z.object({
  phone: z.string()
    .min(1, "رقم الهاتف مطلوب")
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^09\d{8}$/, "رقم الهاتف يجب أن يكون بصيغة 09xxxxxxxx")),
  governorate: z.string()
    .min(1, "يرجى اختيار المحافظة")
    .refine((v) => (SYRIAN_GOVERNORATES as readonly string[]).includes(v), "يرجى اختيار محافظة صحيحة"),
  area: z.string().trim().max(100, "المنطقة طويلة جداً").optional(),
  street: z.string().max(200, "العنوان طويل جداً").optional(),
  notes: z.string().max(1000, "الملاحظات طويلة جداً").optional(),
});



interface CartItem {
  id: string;
  quantity: number;
  product_id: string;
  variant_id?: string | null;
  variantLabel?: string;
  product: {
    id: string;
    name: string;
    price: number;
    image_url: string;
    vendor_id: string;
    shipping_cost?: number;
    product_type?: string;
    shipping_duration_text?: string | null;
    platform_free_shipping?: boolean | null;
    platform_shipping_fee?: number | null;
    platform_cod_enabled?: boolean | null;
    platform_sham_cash_enabled?: boolean | null;
    platform_electronic_payment_enabled?: boolean | null;
  };
}


interface PlatformOptions {
  sham_cash_enabled: boolean;
  cod_enabled: boolean;
  electronic_payment_enabled: boolean;
  free_shipping: boolean;
  shipping_fee: number;
  apply_to_all_products: boolean;
  instructions: string | null;
  electronic_payment_instructions: string | null;
}

type PlatformMethod = "sham_cash" | "cod" | "electronic";

const METHOD_LABELS: Record<PlatformMethod, string> = {
  cod: "الدفع عند الاستلام",
  sham_cash: "شام كاش",
  electronic: "الدفع الإلكتروني في سوريا",
};

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
  const [platformOptions, setPlatformOptions] = useState<PlatformOptions | null>(null);
  const [selectedPlatformMethod, setSelectedPlatformMethod] = useState<PlatformMethod | null>(null);
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


  const composeAddress = () =>
    ["عنوان التوصيل", formData.governorate, formData.street]
      .filter((v) => v && v.trim())
      .join("، ");





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
          variant_id,
          variant:product_variants(id, attributes, price, discount_price, stock_quantity),
          product:products(id, name, price, image_url, vendor_id, shipping_cost, product_type, shipping_duration_text, platform_free_shipping, platform_shipping_fee, platform_cod_enabled, platform_sham_cash_enabled, platform_electronic_payment_enabled)
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      // Each chosen size/color keeps its own price — mirror it into the row so
      // the displayed totals match what create_order computes server-side.
      const rows = ((data as any[]) || []).map((row: any) => {
        const v = row.variant;
        if (!v) return row;
        const attrs = (v.attributes || {}) as Record<string, string>;
        return {
          ...row,
          variantLabel: Object.values(attrs).filter(Boolean).join(" / "),
          product: {
            ...row.product,
            price: Number(v.discount_price ?? v.price ?? row.product?.price),
          },
        };
      });
      setCartItems(rows as any);

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

  // Payment + shipping model (enforced server-side in create_order):
  //  - Seller products   -> per-product shipping, Cash on Delivery only.
  //  - Turkish (platform) products -> shipping and payment methods come from
  //    the admin "Turkish Products" settings. The admin can also choose to
  //    apply those settings to all products.
  const hasPlatformItems = cartItems.some((i) => i.product.product_type === "platform");
  const hasSellerItems = cartItems.some((i) => i.product.product_type !== "platform");
  const isMixedCart = hasPlatformItems && hasSellerItems;
  const platformEnabled = isEnabled("platform_marketplace");
  const applyToAll = !!platformOptions?.apply_to_all_products;
  const usePlatformRules = (hasPlatformItems && !isMixedCart && platformEnabled) || applyToAll;

  // Per-platform-product settings: a method is offered only when it is enabled
  // for every platform product in the cart (falls back to the global platform
  // settings when a product leaves a field empty). Mirrors create_order.
  const platformItems = cartItems.filter((i) => i.product.product_type === "platform");
  const perProduct = (() => {
    if (platformItems.length === 0) return null;
    let cod = true;
    let sham = true;
    let elec = true;
    let free = true;
    let fee = 0;
    for (const { product: p } of platformItems) {
      cod = cod && (p.platform_cod_enabled ?? !!platformOptions?.cod_enabled);
      sham = sham && (p.platform_sham_cash_enabled ?? !!platformOptions?.sham_cash_enabled);
      elec = elec && (p.platform_electronic_payment_enabled ?? !!platformOptions?.electronic_payment_enabled);
      const isFree = p.platform_free_shipping ?? !!platformOptions?.free_shipping;
      if (!isFree) {
        free = false;
        fee = Math.max(
          fee,
          p.platform_free_shipping == null
            ? Number(platformOptions?.shipping_fee || 0)
            : Number(p.platform_shipping_fee || 0)
        );
      }
    }
    return { cod, sham, elec, free, fee };
  })();

  const platformRulesSource =
    hasPlatformItems && !isMixedCart && platformEnabled && perProduct
      ? perProduct
      : {
          cod: !!platformOptions?.cod_enabled,
          sham: !!platformOptions?.sham_cash_enabled,
          elec: !!platformOptions?.electronic_payment_enabled,
          free: !!platformOptions?.free_shipping,
          fee: Number(platformOptions?.shipping_fee || 0),
        };

  const availableMethods: PlatformMethod[] = usePlatformRules
    ? ([
        platformRulesSource.cod ? "cod" : null,
        platformRulesSource.sham ? "sham_cash" : null,
        platformRulesSource.elec ? "electronic" : null,
      ].filter(Boolean) as PlatformMethod[])
    : ["cod"];

  const platformBlocked =
    hasPlatformItems && (!platformEnabled || availableMethods.length === 0);

  const paymentMethod: PlatformMethod = usePlatformRules
    ? ((selectedPlatformMethod && availableMethods.includes(selectedPlatformMethod)
        ? selectedPlatformMethod
        : availableMethods[0]) ?? "cod")
    : "cod";

  const productShipping = cartItems.reduce(
    (sum, item) => sum + Number((item.product as any).shipping_cost || 0),
    0
  );
  const shippingTotal = usePlatformRules
    ? platformRulesSource.free
      ? 0
      : platformRulesSource.fee
    : productShipping;

  const total = Math.max(subtotal + shippingTotal - discount, 0);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("get_platform_payment_options");
      const opts = Array.isArray(data) ? data[0] : (data as any);
      if (!opts) return;
      setPlatformOptions({
        sham_cash_enabled: !!opts.sham_cash_enabled,
        cod_enabled: !!opts.cod_enabled,
        electronic_payment_enabled: !!opts.electronic_payment_enabled,
        free_shipping: !!opts.free_shipping,
        shipping_fee: Number(opts.shipping_fee || 0),
        apply_to_all_products: !!opts.apply_to_all_products,
        instructions: opts.instructions ?? null,
        electronic_payment_instructions: opts.electronic_payment_instructions ?? null,
      });
    })();
  }, []);

  useEffect(() => {
    if (!platformOptions?.sham_cash_enabled) return;
    void (async () => {
      const { data } = await supabase
        .from("platform_payment_settings")
        .select("sham_cash_account_name, sham_cash_account_number, instructions, is_active")
        .eq("id", 1)
        .maybeSingle();
      if (data) setShamSettings(data as PlatformPaymentSettings);
    })();
  }, [platformOptions?.sham_cash_enabled]);

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
    if (!user || cartItems.length === 0 || submitting) return;

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
      const fullAddress = composeAddress();
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
              shipping_address: fullAddress,
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
            : paymentMethod === "electronic"
            ? "يرجى إتمام الدفع الإلكتروني وفق التعليمات لتأكيد الطلب."
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
      if (message.includes("PICKUP_CENTER")) {
        toast({
          title: "مركز الاستلام غير متاح",
          description: "مركز الاستلام المختار غير متاح حالياً. يرجى اختيار مركز آخر.",
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
                        <img loading="lazy" decoding="async"
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium">{item.product.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            الكمية: {item.quantity}
                          </p>
                          {!usePlatformRules && (
                            <p className="text-sm inline-flex items-center gap-1 mt-0.5">
                              <Truck className="h-3.5 w-3.5 text-primary" />
                              {Number(item.product.shipping_cost || 0) === 0
                                ? "شحن مجاني"
                                : `الشحن: ${Number(item.product.shipping_cost || 0).toLocaleString()} ل.س`}
                            </p>
                          )}
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
                  ) : (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm space-y-2">
                      <p className="font-semibold">
                        {availableMethods.length > 1
                          ? "اختر طريقة الدفع"
                          : `طريقة الدفع: ${METHOD_LABELS[paymentMethod]}`}
                      </p>

                      {availableMethods.length > 1 ? (
                        <div className="grid gap-2">
                          {availableMethods.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setSelectedPlatformMethod(m)}
                              className={`text-right p-2.5 rounded-lg border transition-colors ${paymentMethod === m ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                            >
                              <span className="font-semibold inline-flex items-center gap-1.5">
                                {m === "cod" ? (
                                  <Banknote className="h-4 w-4" />
                                ) : m === "sham_cash" ? (
                                  <Wallet className="h-4 w-4" />
                                ) : (
                                  <CreditCard className="h-4 w-4" />
                                )}
                                {METHOD_LABELS[m]}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {paymentMethod === "cod" && (
                        <p className="text-muted-foreground">
                          تدفع المبلغ نقداً عند استلام الطلب.
                        </p>
                      )}

                      {paymentMethod === "sham_cash" && (
                        shamSettings?.sham_cash_account_number ? (
                          <div className="space-y-0.5">
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
                        )
                      )}

                      {paymentMethod === "electronic" && (
                        <p className="text-muted-foreground">
                          {platformOptions?.electronic_payment_instructions ||
                            "سيتم تزويدك بتفاصيل الدفع الإلكتروني بعد تأكيد الطلب."}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground border-t pt-2">
                        الشحن:{" "}
                        {shippingTotal > 0
                          ? `${shippingTotal.toLocaleString()} ل.س`
                          : "شحن مجاني"}
                      </p>
                    </div>
                  )}


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

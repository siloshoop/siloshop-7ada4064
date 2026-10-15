import { currencySymbol } from "@/lib/currency";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Tag } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { COUPON_DATE_ORDER_ERROR, validateCouponDates } from "@/lib/couponDates";
import OrderProductImage from "@/components/orders/OrderProductImage";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_purchase: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  product_ids: string[];
  currency: string;
  max_discounted_units?: number | null;
  max_units_per_order?: number | null;
  max_uses_per_customer?: number | null;
  starts_at?: string | null;
  combinable_with_sale?: boolean;
}

interface CouponStats {
  reserved_units: number;
  used_units: number;
  redemptions: number;
}

/** Derived from saved dates and limits, so expiry never depends on a background job. */
const couponStatus = (c: Coupon, st?: CouponStats) => {
  const now = Date.now();
  const unitsTaken = (st?.reserved_units ?? 0) + (st?.used_units ?? 0);
  if (!c.is_active) return { label: "موقوف", cls: "bg-muted text-muted-foreground" };
  if (c.expires_at && new Date(c.expires_at).getTime() <= now) return { label: "منتهي", cls: "bg-muted text-muted-foreground" };
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return { label: "مجدول", cls: "bg-secondary text-secondary-foreground" };
  if ((c.max_uses && c.used_count >= c.max_uses) || (c.max_discounted_units && unitsTaken >= c.max_discounted_units))
    return { label: "نفدت الكمية", cls: "bg-destructive/10 text-destructive" };
  return { label: "نشط", cls: "bg-primary/10 text-primary" };
};

const ManageCoupons = () => {
  const { user, loading: authLoading } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<Record<string, CouponStats>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: "",
    min_purchase: "",
    max_uses: "",
    expires_at: "",
    currency: "SYP",
    starts_at: "",
    max_discounted_units: "",
    max_units_per_order: "",
    max_uses_per_customer: "",
    combinable_with_sale: false,
  });
  const [products, setProducts] = useState<{ id: string; name: string; currency: string | null; image_url: string | null; images: string[] | null }[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [dateError, setDateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("products")
      .select("id, name, currency, image_url, images")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setProducts((data as any) || []));
  }, [user]);

  const toggleProduct = (id: string) =>
    setSelectedProducts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchCoupons();
  }, [user]);

  const fetchCoupons = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("coupons")
      .select("*")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setCoupons(data as Coupon[]);
    }
    const { data: st } = await (supabase.rpc as any)("seller_coupon_stats");
    const map: Record<string, CouponStats> = {};
    for (const r of (st ?? []) as any[]) {
      map[r.coupon_id] = { reserved_units: Number(r.reserved_units), used_units: Number(r.used_units), redemptions: Number(r.redemptions) };
    }
    setStats(map);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || saving) return;
    if (selectedProducts.length === 0) {
      toast({ title: "اختر المنتجات", description: "يجب اختيار منتج واحد على الأقل من منتجاتك ليعمل عليه الكوبون.", variant: "destructive" });
      return;
    }

    let dates: ReturnType<typeof validateCouponDates>;
    try {
      dates = validateCouponDates(formData.starts_at, formData.expires_at);
      setDateError(null);
    } catch (error) {
      setDateError(error instanceof Error ? error.message : COUPON_DATE_ORDER_ERROR);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("coupons").insert({
        product_ids: selectedProducts,
        currency: formData.currency,
        vendor_id: user.id,
        code: formData.code.toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        min_purchase: formData.min_purchase ? parseFloat(formData.min_purchase) : 0,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        ...dates,
        max_discounted_units: formData.max_discounted_units ? parseInt(formData.max_discounted_units) : null,
        max_units_per_order: formData.max_units_per_order ? parseInt(formData.max_units_per_order) : null,
        max_uses_per_customer: formData.max_uses_per_customer ? parseInt(formData.max_uses_per_customer) : null,
        combinable_with_sale: formData.combinable_with_sale,
      } as any);

      if (error) throw error;

      toast({
        title: "تم بنجاح",
        description: "تم إنشاء كوبون الخصم",
      });

      setFormData({
        code: "",
        discount_type: "percentage",
        discount_value: "",
        min_purchase: "",
        max_uses: "",
        expires_at: "",
        currency: "SYP",
        starts_at: "",
        max_discounted_units: "",
        max_units_per_order: "",
        max_uses_per_customer: "",
        combinable_with_sale: false,
      });
      setSelectedProducts([]);
      setShowForm(false);
      fetchCoupons();
    } catch (error) {
      const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
      toast({
        title: "خطأ",
        description: message?.includes("INVALID_COUPON_DATES") ? COUPON_DATE_ORDER_ERROR : message || "تعذر إنشاء الكوبون، حاول مجددًا.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const next = !currentStatus;
    const { data, error } = await supabase
      .from("coupons")
      .update({ is_active: next })
      .eq("id", id)
      .select("id,is_active")
      .single();

    if (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCoupons((prev) => prev.map((coupon) => coupon.id === id ? { ...coupon, is_active: data.is_active } : coupon));
      toast({ title: data.is_active ? "تم تفعيل الكوبون" : "تم إيقاف الكوبون" });
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الكوبون؟")) return;

    const { error } = await supabase
      .from("coupons")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "تم الحذف",
        description: "تم حذف الكوبون بنجاح",
      });
      fetchCoupons();
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

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex min-w-0 items-center gap-3">
                <Tag className="h-8 w-8 text-primary" />
                <h1 className="min-w-0 text-2xl font-bold leading-tight sm:text-3xl">إدارة كوبونات الخصم</h1>
              </div>
              <p className="text-muted-foreground">إنشاء وإدارة رموز الخصم</p>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="ml-2 h-5 w-5" />
              {showForm ? "إلغاء" : "إضافة كوبون"}
            </Button>
          </div>

          {showForm && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>كوبون جديد</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">رمز الكوبون *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                      placeholder="SUMMER2024"
                      className="uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="discount_type">نوع الخصم *</Label>
                      <Select
                        value={formData.discount_type}
                        onValueChange={(value) => setFormData({ ...formData, discount_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">نسبة مئوية</SelectItem>
                          <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="discount_value">
                        قيمة الخصم * {formData.discount_type === "percentage" ? "(%)" : `(${currencySymbol(formData.currency)})`}
                      </Label>
                      <Input
                        id="discount_value"
                        type="number"
                        step="0.01"
                        value={formData.discount_value}
                        onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                        required
                        placeholder="10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="min_purchase">الحد الأدنى للشراء ({currencySymbol(formData.currency)})</Label>
                      <Input
                        id="min_purchase"
                        type="number"
                        step="0.01"
                        value={formData.min_purchase}
                        onChange={(e) => setFormData({ ...formData, min_purchase: e.target.value })}
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max_uses">الحد الأقصى للاستخدام</Label>
                      <Input
                        id="max_uses"
                        type="number"
                        value={formData.max_uses}
                        onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                        placeholder="غير محدود"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-3">
                    {([
                      ["max_discounted_units", "إجمالي القطع المخفضة"],
                      ["max_units_per_order", "قطع مخفضة لكل طلب"],
                      ["max_uses_per_customer", "مرات الاستخدام لكل عميل"],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={key}>{label}</Label>
                        <Input
                          id={key}
                          type="number"
                          min={1}
                          step={1}
                          value={formData[key]}
                          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                          placeholder="غير محدود"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">اترك الحقل فارغًا ليكون غير محدود. مثال: إذا كان الحد قطعة واحدة لكل طلب، يُخصم سعر قطعة واحدة فقط حتى لو اشترى العميل أكثر.</p>

                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.combinable_with_sale}
                      onChange={(e) => setFormData({ ...formData, combinable_with_sale: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    يمكن جمعه مع تخفيضات المنتجات (عروض اليوم)
                  </label>

                  <div className="space-y-2">
                    <Label>عملة المبالغ</Label>
                    <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SYP">ليرة سورية (ل.س)</SelectItem>
                        <SelectItem value="USD">دولار ($)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">الخصم الثابت يعمل فقط على المنتجات بنفس العملة. النسبة المئوية تعمل بأي عملة.</p>
                  </div>

                  <div className="space-y-2">
                    <Label>المنتجات المشمولة بالكوبون * ({selectedProducts.length})</Label>
                    <p className="text-xs text-muted-foreground">الكوبون يعمل فقط على منتجاتك التي تختارها هنا، ولا يعمل على منتجات البائعين الآخرين.</p>
                    {products.length === 0 ? (
                      <p className="text-sm text-muted-foreground">لا توجد منتجات في متجرك بعد.</p>
                    ) : (
                      <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                        {products.map((p) => (
                          <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(p.id)}
                              onChange={() => toggleProduct(p.id)}
                              className="h-4 w-4 accent-primary"
                            />
                            <OrderProductImage image={p.image_url} fallbackImage={p.images?.[0]} alt={p.name} className="h-10 w-10 shrink-0 rounded object-cover" />
                            <span className="min-w-0 flex-1 truncate">{p.name}</span>
                            <span className="text-xs text-muted-foreground">{currencySymbol(p.currency)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="starts_at">تاريخ بدء الكوبون</Label>
                    <Input
                      id="starts_at"
                      type="datetime-local"
                      dir="ltr"
                      aria-invalid={!!dateError}
                      aria-describedby={dateError ? "coupon-date-error" : undefined}
                      value={formData.starts_at}
                      onChange={(e) => { setFormData({ ...formData, starts_at: e.target.value }); setDateError(null); }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expires_at">تاريخ انتهاء الصلاحية</Label>
                    <Input
                      id="expires_at"
                      type="datetime-local"
                      dir="ltr"
                      aria-invalid={!!dateError}
                      aria-describedby={dateError ? "coupon-date-error" : undefined}
                      value={formData.expires_at}
                      onChange={(e) => { setFormData({ ...formData, expires_at: e.target.value }); setDateError(null); }}
                    />
                  </div>
                  {dateError && <p id="coupon-date-error" role="alert" className="text-sm text-destructive">{dateError}</p>}

                  <Button type="submit" className="w-full" disabled={saving}>
                    {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    إنشاء الكوبون
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {coupons.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Tag className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground">لا توجد كوبونات بعد</p>
                </CardContent>
              </Card>
            ) : (
              coupons.map((coupon) => {
                const st = stats[coupon.id];
                const status = couponStatus(coupon, st);
                const taken = (st?.reserved_units ?? 0) + (st?.used_units ?? 0);
                return (
                <Card key={coupon.id}>
                  <CardContent className="p-6">
                    <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex min-w-0 flex-wrap items-center gap-3">
                          <h3 className="min-w-0 break-all font-mono text-xl font-bold sm:text-2xl">{coupon.code}</h3>
                          <span className={`text-xs px-2 py-1 rounded ${status.cls}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          خصم {coupon.discount_value}
                          {coupon.discount_type === 'percentage' ? '%' : ` ${currencySymbol(coupon.currency)}`}
                          {coupon.min_purchase > 0 && ` - حد أدنى ${coupon.min_purchase} ${currencySymbol(coupon.currency)}`}
                          {' - '}
                          {coupon.product_ids?.length
                            ? `يشمل ${coupon.product_ids.length} منتج`
                            : 'لا يشمل أي منتج — أنشئ كوبونًا جديدًا واختر المنتجات'}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {coupon.expires_at && (
                            <span>
                              ينتهي: {format(new Date(coupon.expires_at), "dd MMM yyyy HH:mm", { locale: ar })}
                            </span>
                          )}
                          <span>
                            استخدم {coupon.used_count} مرة
                            {coupon.max_uses && ` من ${coupon.max_uses}`}
                          </span>
                          <span>طلبات بالكوبون: {st?.redemptions ?? 0}</span>
                          <span>قطع مخفضة مستخدمة: {st?.used_units ?? 0}</span>
                          <span>محجوزة (طلبات قيد التنفيذ): {st?.reserved_units ?? 0}</span>
                          <span>
                            المتبقي: {coupon.max_discounted_units ? `${Math.max(coupon.max_discounted_units - taken, 0)} من ${coupon.max_discounted_units}` : "غير محدود"}
                          </span>
                          {coupon.max_units_per_order && <span>لكل طلب: {coupon.max_units_per_order} قطعة</span>}
                          {coupon.max_uses_per_customer && <span>لكل عميل: {coupon.max_uses_per_customer} مرة</span>}
                          <span>{coupon.combinable_with_sale ? "يُجمع مع التخفيضات" : "لا يُجمع مع التخفيضات"}</span>
                          {coupon.starts_at && <span>يبدأ: {format(new Date(coupon.starts_at), "dd MMM yyyy HH:mm", { locale: ar })}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={coupon.is_active ? "outline" : "default"}
                          size="sm"
                          onClick={() => toggleStatus(coupon.id, coupon.is_active)}
                        >
                          {coupon.is_active ? 'إلغاء التفعيل' : 'تفعيل'}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteCoupon(coupon.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ManageCoupons;

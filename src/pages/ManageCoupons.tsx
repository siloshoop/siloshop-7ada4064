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
}

const ManageCoupons = () => {
  const { user, loading: authLoading } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
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
  });

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
      setCoupons(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase.from("coupons").insert({
        vendor_id: user.id,
        code: formData.code.toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        min_purchase: formData.min_purchase ? parseFloat(formData.min_purchase) : 0,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        expires_at: formData.expires_at || null,
      });

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
      });
      setShowForm(false);
      fetchCoupons();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("coupons")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchCoupons();
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Tag className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold">إدارة كوبونات الخصم</h1>
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

                  <div className="grid grid-cols-2 gap-4">
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
                        قيمة الخصم * {formData.discount_type === "percentage" ? "(%)" : "(ريال)"}
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min_purchase">الحد الأدنى للشراء (ريال)</Label>
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

                  <div className="space-y-2">
                    <Label htmlFor="expires_at">تاريخ انتهاء الصلاحية</Label>
                    <Input
                      id="expires_at"
                      type="datetime-local"
                      value={formData.expires_at}
                      onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    />
                  </div>

                  <Button type="submit" className="w-full">
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
              coupons.map((coupon) => (
                <Card key={coupon.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold font-mono">{coupon.code}</h3>
                          <span className={`text-xs px-2 py-1 rounded ${
                            coupon.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {coupon.is_active ? 'نشط' : 'غير نشط'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          خصم {coupon.discount_value}
                          {coupon.discount_type === 'percentage' ? '%' : ' ريال'}
                          {coupon.min_purchase > 0 && ` - حد أدنى ${coupon.min_purchase} ريال`}
                        </p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {coupon.expires_at && (
                            <span>
                              ينتهي: {format(new Date(coupon.expires_at), "dd MMM yyyy", { locale: ar })}
                            </span>
                          )}
                          <span>
                            استخدم {coupon.used_count} مرة
                            {coupon.max_uses && ` من ${coupon.max_uses}`}
                          </span>
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
              ))
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ManageCoupons;

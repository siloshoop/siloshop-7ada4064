import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Edit, Trash2, Percent, Calendar, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface Deal {
  id: string;
  product_id: string;
  discount_percentage: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  product: {
    name: string;
    image_url: string | null;
    price: number;
  };
}

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
}

const ManageDeals = () => {
  const { user, loading: authLoading } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [formData, setFormData] = useState({
    product_id: "",
    discount_percentage: 10,
    end_date: "",
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch vendor's products
        const { data: productsData } = await supabase
          .from("products")
          .select("id, name, image_url, price")
          .eq("vendor_id", user.id)
          .eq("is_active", true);

        setProducts(productsData || []);

        // Fetch vendor's deals
        const { data: dealsData } = await supabase
          .from("daily_deals")
          .select(`
            *,
            product:products(name, image_url, price)
          `)
          .in("product_id", (productsData || []).map(p => p.id))
          .order("created_at", { ascending: false });

        setDeals((dealsData || []).map(d => ({
          ...d,
          product: d.product as Deal["product"]
        })));
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id || !formData.end_date) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      if (editingDeal) {
        // Update existing deal
        const { error } = await supabase
          .from("daily_deals")
          .update({
            product_id: formData.product_id,
            discount_percentage: formData.discount_percentage,
            end_date: formData.end_date,
            is_active: formData.is_active,
          })
          .eq("id", editingDeal.id);

        if (error) throw error;

        toast({
          title: "تم بنجاح",
          description: "تم تحديث العرض بنجاح",
        });
      } else {
        // Create new deal
        const { error } = await supabase
          .from("daily_deals")
          .insert({
            product_id: formData.product_id,
            discount_percentage: formData.discount_percentage,
            end_date: formData.end_date,
            is_active: formData.is_active,
          });

        if (error) throw error;

        toast({
          title: "تم بنجاح",
          description: "تم إنشاء العرض بنجاح",
        });
      }

      // Refresh deals
      const { data: dealsData } = await supabase
        .from("daily_deals")
        .select(`
          *,
          product:products(name, image_url, price)
        `)
        .in("product_id", products.map(p => p.id))
        .order("created_at", { ascending: false });

      setDeals((dealsData || []).map(d => ({
        ...d,
        product: d.product as Deal["product"]
      })));

      setIsDialogOpen(false);
      setEditingDeal(null);
      setFormData({
        product_id: "",
        discount_percentage: 10,
        end_date: "",
        is_active: true,
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setFormData({
      product_id: deal.product_id,
      discount_percentage: deal.discount_percentage,
      end_date: deal.end_date.split("T")[0],
      is_active: deal.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (dealId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا العرض؟")) return;

    try {
      const { error } = await supabase
        .from("daily_deals")
        .delete()
        .eq("id", dealId);

      if (error) throw error;

      setDeals(deals.filter(d => d.id !== dealId));
      toast({
        title: "تم بنجاح",
        description: "تم حذف العرض بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (deal: Deal) => {
    try {
      const { error } = await supabase
        .from("daily_deals")
        .update({ is_active: !deal.is_active })
        .eq("id", deal.id);

      if (error) throw error;

      setDeals(deals.map(d => 
        d.id === deal.id ? { ...d, is_active: !d.is_active } : d
      ));

      toast({
        title: "تم بنجاح",
        description: deal.is_active ? "تم إيقاف العرض" : "تم تفعيل العرض",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
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
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">إدارة العروض اليومية</h1>
            <p className="text-muted-foreground">إنشاء وتعديل العروض على منتجاتك</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>العروض اليومية</CardTitle>
                <CardDescription>قائمة العروض النشطة والمنتهية</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setEditingDeal(null);
                  setFormData({
                    product_id: "",
                    discount_percentage: 10,
                    end_date: "",
                    is_active: true,
                  });
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة عرض
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingDeal ? "تعديل العرض" : "إضافة عرض جديد"}</DialogTitle>
                    <DialogDescription>
                      {editingDeal ? "قم بتعديل تفاصيل العرض" : "أضف خصم على أحد منتجاتك"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="product">المنتج</Label>
                      <Select
                        value={formData.product_id}
                        onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر المنتج" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} - {product.price} ل.س
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="discount">نسبة الخصم (%)</Label>
                      <Input
                        id="discount"
                        type="number"
                        min={1}
                        max={90}
                        value={formData.discount_percentage}
                        onChange={(e) => setFormData({ ...formData, discount_percentage: parseInt(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="end_date">تاريخ انتهاء العرض</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="is_active">تفعيل العرض</Label>
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          جاري الحفظ...
                        </>
                      ) : editingDeal ? (
                        "تحديث العرض"
                      ) : (
                        "إنشاء العرض"
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {deals.length > 0 ? (
              <div className="space-y-4">
                {deals.map((deal) => {
                  const isExpired = new Date(deal.end_date) < new Date();
                  const discountedPrice = deal.product.price * (1 - deal.discount_percentage / 100);

                  return (
                    <div
                      key={deal.id}
                      className={`flex items-center gap-4 p-4 border rounded-lg ${
                        isExpired ? "opacity-60 bg-muted/30" : ""
                      }`}
                    >
                      <img
                        src={deal.product.image_url || "/placeholder.svg"}
                        alt={deal.product.name}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{deal.product.name}</h3>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              isExpired
                                ? "bg-destructive/20 text-destructive"
                                : deal.is_active
                                ? "bg-success/15 text-success"
                                : "bg-warning/15 text-warning"
                            }`}
                          >
                            {isExpired ? "منتهي" : deal.is_active ? "نشط" : "متوقف"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            خصم {deal.discount_percentage}%
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            ينتهي: {format(new Date(deal.end_date), "d MMM yyyy", { locale: ar })}
                          </span>
                        </div>
                        <div className="mt-1">
                          <span className="text-sm line-through text-muted-foreground">
                            {deal.product.price} ل.س
                          </span>
                          <span className="text-sm font-bold text-primary mr-2">
                            {discountedPrice.toFixed(0)} ل.س
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={deal.is_active}
                          onCheckedChange={() => handleToggleActive(deal)}
                          disabled={isExpired}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(deal)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDelete(deal.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Percent className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">لا توجد عروض حالياً</p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة عرض جديد
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default ManageDeals;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, MapPin, Plus, Trash2, Star, Phone, Home } from "lucide-react";

export interface DeliveryAddress {
  id: string;
  label: string;
  recipient_name: string;
  city: string;
  street: string;
  phone: string;
  notes: string | null;
  is_default: boolean;
}

const schema = z.object({
  label: z.string().trim().min(1, "أدخل اسماً للعنوان (مثل: المنزل)").max(50),
  recipient_name: z.string().trim().min(2, "اسم المستلم مطلوب").max(100),
  city: z.string().trim().min(2, "المدينة مطلوبة").max(100),
  street: z.string().trim().min(3, "الشارع/المنطقة مطلوبة").max(300),
  phone: z.string().trim().regex(/^09\d{8}$/, "رقم سوري بصيغة 09xxxxxxxx"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

const Addresses = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: "",
    recipient_name: "",
    city: "",
    street: "",
    phone: "",
    notes: "",
    is_default: false,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const fetchAddresses = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("delivery_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "خطأ", description: "تعذر جلب العناوين", variant: "destructive" });
    } else {
      setAddresses((data || []) as DeliveryAddress[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const resetForm = () => {
    setForm({ label: "", recipient_name: "", city: "", street: "", phone: "", notes: "", is_default: false });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "بيانات غير صحيحة", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const willBeDefault = form.is_default || addresses.length === 0;
      const { data: inserted, error } = await supabase
        .from("delivery_addresses")
        .insert({
          user_id: user.id,
          label: parsed.data.label,
          recipient_name: parsed.data.recipient_name,
          city: parsed.data.city,
          street: parsed.data.street,
          phone: parsed.data.phone,
          notes: parsed.data.notes || null,
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;
      if (willBeDefault && inserted) {
        await supabase.rpc("set_default_address", { _address_id: inserted.id });
      }
      toast({ title: "تمت الإضافة", description: "تم حفظ العنوان" });
      setOpen(false);
      resetForm();
      void fetchAddresses();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا العنوان؟")) return;
    const { error } = await supabase.from("delivery_addresses").delete().eq("id", id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحذف" });
      void fetchAddresses();
    }
  };

  const handleSetDefault = async (id: string) => {
    const { error } = await supabase.rpc("set_default_address", { _address_id: id });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم", description: "تم تعيينه كعنوان افتراضي" });
      void fetchAddresses();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              عناوين التوصيل
            </h1>
            <p className="text-sm text-muted-foreground mt-1">احفظ عناوينك لتسريع إتمام الطلبات</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 ml-1" /> إضافة عنوان
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>إضافة عنوان جديد</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>اسم العنوان (مثل: المنزل، العمل)</Label>
                  <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="المنزل" required />
                </div>
                <div className="space-y-1.5">
                  <Label>اسم المستلم</Label>
                  <Input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>المدينة</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="دمشق" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>الهاتف</Label>
                    <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xxxxxxxx" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>المنطقة / الشارع / تفاصيل الوصول</Label>
                  <Textarea rows={3} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder="المنطقة، الشارع، رقم البناء، الطابق..." required />
                </div>
                <div className="space-y-1.5">
                  <Label>ملاحظات (اختياري)</Label>
                  <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="علامة مميزة أو تعليمات للمندوب" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
                  تعيين كعنوان افتراضي
                </label>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ العنوان"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : addresses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Home className="h-14 w-14 mx-auto text-muted-foreground" />
              <h2 className="text-xl font-semibold">لا توجد عناوين محفوظة</h2>
              <p className="text-muted-foreground">أضف عنوانك الأول لتسهيل عملية الشراء</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <Card key={addr.id} className={addr.is_default ? "border-primary border-2 shadow-md" : ""}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg">{addr.label}</h3>
                        {addr.is_default && (
                          <Badge className="bg-primary"><Star className="h-3 w-3 ml-1" />افتراضي</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{addr.recipient_name}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(addr.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><span>{addr.city} — {addr.street}</span></p>
                    <p className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4 text-muted-foreground" />{addr.phone}</p>
                    {addr.notes && <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">{addr.notes}</p>}
                  </div>
                  {!addr.is_default && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleSetDefault(addr.id)}>
                      <Star className="h-4 w-4 ml-1" /> تعيين كافتراضي
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Addresses;
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, MapPin, Plus, Trash2, Star, Phone, Home, Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SYRIAN_GOVERNORATES } from "@/lib/syrianGovernorates";

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
  recipient_name: z.string().trim().min(2, "اسم المستلم مطلوب").max(100),
  city: z.string().trim().refine((v) => (SYRIAN_GOVERNORATES as readonly string[]).includes(v), "يرجى اختيار المحافظة"),
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    recipient_name: "",
    city: "",
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
    setForm({ recipient_name: "", city: "", phone: "", notes: "", is_default: false });
    setEditingId(null);
  };

  const openEdit = (addr: DeliveryAddress) => {
    setEditingId(addr.id);
    setForm({
      recipient_name: addr.recipient_name,
      city: addr.city,
      phone: addr.phone,
      notes: addr.notes || "",
      is_default: addr.is_default,
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "بيانات غير صحيحة", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from("delivery_addresses")
          .update({
            recipient_name: parsed.data.recipient_name,
            city: parsed.data.city,
            phone: parsed.data.phone,
            notes: parsed.data.notes || null,
          })
          .eq("id", editingId)
          .eq("user_id", user.id);
        if (error) throw error;
        // Handle default toggle
        const original = addresses.find((a) => a.id === editingId);
        if (form.is_default && !original?.is_default) {
          await supabase.rpc("set_default_address", { _address_id: editingId });
        }
        toast({ title: "تم التحديث", description: "تم حفظ التعديلات" });
      } else {
        const willBeDefault = form.is_default || addresses.length === 0;
        const { data: inserted, error } = await supabase
          .from("delivery_addresses")
          .insert({
            user_id: user.id,
            label: "عنوان التوصيل",
            recipient_name: parsed.data.recipient_name,
            city: parsed.data.city,
            street: "-",
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
      }
      setOpen(false);
      resetForm();
      void fetchAddresses();
    } catch (err) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId || !user) return;
    const target = addresses.find((a) => a.id === deleteId);
    const wasDefault = !!target?.is_default;
    const { error } = await supabase.from("delivery_addresses").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      setDeleteId(null);
      return;
    }
    // If we deleted the default, promote the most recent remaining address as default
    if (wasDefault) {
      const { data: remaining } = await supabase
        .from("delivery_addresses")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (remaining && remaining.length > 0) {
        await supabase.rpc("set_default_address", { _address_id: remaining[0].id });
        toast({ title: "تم الحذف", description: "تم تعيين عنوان آخر كافتراضي تلقائياً" });
      } else {
        toast({ title: "تم الحذف" });
      }
    } else {
      toast({ title: "تم الحذف" });
    }
    setDeleteId(null);
    void fetchAddresses();
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
                <DialogTitle>{editingId ? "تعديل العنوان" : "إضافة عنوان جديد"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>اسم المستلم</Label>
                  <Input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>المحافظة</Label>
                    <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المحافظة" />
                      </SelectTrigger>
                      <SelectContent>
                        {SYRIAN_GOVERNORATES.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>الهاتف</Label>
                    <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xxxxxxxx" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>تفاصيل الوصول / ملاحظات (اختياري)</Label>
                  <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="تفاصيل إضافية أو تعليمات للمندوب" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
                  تعيين كعنوان افتراضي
                </label>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? "حفظ التعديلات" : "حفظ العنوان")}
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
                        <h3 className="font-bold text-lg">{addr.recipient_name}</h3>
                        {addr.is_default && (
                          <Badge className="bg-primary"><Star className="h-3 w-3 ml-1" />افتراضي</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(addr)} aria-label="تعديل">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(addr.id)} aria-label="حذف">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /><span>{addr.city}</span></p>
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
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف العنوان</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا العنوان؟ لا يمكن التراجع عن هذا الإجراء.
              {addresses.find((a) => a.id === deleteId)?.is_default && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ملاحظة: هذا هو عنوانك الافتراضي. سيتم تعيين عنوان آخر كافتراضي تلقائياً.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Addresses;
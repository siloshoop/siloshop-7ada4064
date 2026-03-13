import { useEffect, useState } from "react";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Pencil, Eye, EyeOff, Megaphone, ExternalLink, Image, CalendarClock, CalendarCheck, CalendarX, Clock } from "lucide-react";
import { format, isPast, isFuture, isWithinInterval } from "date-fns";
import { ar } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface NativeAd {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_text: string;
  cta_url: string | null;
  sponsor_name: string;
  placement: string;
  priority: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

const placementOptions = [
  { value: "search", label: "صفحة البحث" },
  { value: "home", label: "الصفحة الرئيسية" },
  { value: "category", label: "صفحة التصنيف" },
];

const ManageNativeAds = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [ads, setAds] = useState<NativeAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image_url: "",
    cta_text: "تسوق الآن",
    cta_url: "",
    sponsor_name: "",
    placement: "search",
    priority: "0",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    if (isAdmin) fetchAds();
  }, [isAdmin]);

  const fetchAds = async () => {
    const { data, error } = await supabase
      .from("native_ads")
      .select("*")
      .order("priority", { ascending: false });

    if (!error) setAds(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      title: "", description: "", image_url: "", cta_text: "تسوق الآن",
      cta_url: "", sponsor_name: "", placement: "search", priority: "0",
      start_date: "", end_date: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        image_url: formData.image_url || null,
        cta_text: formData.cta_text,
        cta_url: formData.cta_url || null,
        sponsor_name: formData.sponsor_name,
        placement: formData.placement,
        priority: parseInt(formData.priority),
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      };

      if (editingId) {
        const { error } = await supabase.from("native_ads").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "تم التحديث", description: "تم تحديث الإعلان بنجاح" });
      } else {
        const { error } = await supabase.from("native_ads").insert(payload);
        if (error) throw error;
        toast({ title: "تم بنجاح", description: "تم إنشاء الإعلان" });
      }
      resetForm();
      fetchAds();
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (ad: NativeAd) => {
    setFormData({
      title: ad.title,
      description: ad.description || "",
      image_url: ad.image_url || "",
      cta_text: ad.cta_text,
      cta_url: ad.cta_url || "",
      sponsor_name: ad.sponsor_name,
      placement: ad.placement,
      priority: ad.priority.toString(),
      start_date: ad.start_date ? ad.start_date.slice(0, 16) : "",
      end_date: ad.end_date ? ad.end_date.slice(0, 16) : "",
    });
    setEditingId(ad.id);
    setShowForm(true);
  };

  const toggleStatus = async (id: string, current: boolean) => {
    const { error } = await supabase.from("native_ads").update({ is_active: !current }).eq("id", id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      fetchAds();
      toast({ title: current ? "تم إلغاء التفعيل" : "تم التفعيل" });
    }
  };

  const deleteAd = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الإعلان؟")) return;
    const { error } = await supabase.from("native_ads").delete().eq("id", id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحذف", description: "تم حذف الإعلان بنجاح" });
      fetchAds();
    }
  };

  if (adminLoading || loading) {
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

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Megaphone className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">إدارة الإعلانات المدمجة</h1>
              </div>
              <p className="text-muted-foreground">إنشاء وتعديل الإعلانات التي تظهر بين المنتجات</p>
            </div>
            <Button onClick={() => showForm && editingId ? resetForm() : setShowForm(!showForm)}>
              <Plus className="ml-2 h-5 w-5" />
              {showForm ? "إلغاء" : "إضافة إعلان"}
            </Button>
          </div>

          {showForm && (
            <Card className="mb-8 border-primary/20">
              <CardHeader>
                <CardTitle>{editingId ? "تعديل الإعلان" : "إعلان جديد"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">عنوان الإعلان *</Label>
                    <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required placeholder="عرض حصري على أحدث المنتجات" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">الوصف</Label>
                    <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="وصف مختصر للإعلان..." rows={3} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sponsor_name">اسم الراعي *</Label>
                      <Input id="sponsor_name" value={formData.sponsor_name} onChange={(e) => setFormData({ ...formData, sponsor_name: e.target.value })} required placeholder="اسم الشركة أو العلامة التجارية" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="placement">موضع العرض</Label>
                      <Select value={formData.placement} onValueChange={(v) => setFormData({ ...formData, placement: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {placementOptions.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="image_url">رابط الصورة</Label>
                    <Input id="image_url" value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })} placeholder="https://example.com/image.jpg" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cta_text">نص الزر</Label>
                      <Input id="cta_text" value={formData.cta_text} onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })} placeholder="تسوق الآن" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cta_url">رابط الزر</Label>
                      <Input id="cta_url" value={formData.cta_url} onChange={(e) => setFormData({ ...formData, cta_url: e.target.value })} placeholder="https://example.com" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">الأولوية</Label>
                      <Input id="priority" type="number" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="start_date">تاريخ البداية</Label>
                      <Input id="start_date" type="datetime-local" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date">تاريخ الانتهاء</Label>
                      <Input id="end_date" type="datetime-local" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">{editingId ? "حفظ التعديلات" : "إنشاء الإعلان"}</Button>
                    {editingId && <Button type="button" variant="outline" onClick={resetForm}>إلغاء التعديل</Button>}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {ads.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Megaphone className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground">لا توجد إعلانات مدمجة بعد</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة أول إعلان
                  </Button>
                </CardContent>
              </Card>
            ) : (
              ads.map((ad) => {
                const now = new Date();
                const startDate = ad.start_date ? new Date(ad.start_date) : null;
                const endDate = ad.end_date ? new Date(ad.end_date) : null;
                
                let scheduleStatus: "active" | "scheduled" | "expired" | "no-schedule" = "no-schedule";
                if (startDate && endDate) {
                  if (isFuture(startDate)) scheduleStatus = "scheduled";
                  else if (isPast(endDate)) scheduleStatus = "expired";
                  else scheduleStatus = "active";
                } else if (startDate && isFuture(startDate)) {
                  scheduleStatus = "scheduled";
                } else if (endDate && isPast(endDate)) {
                  scheduleStatus = "expired";
                } else if (startDate || endDate) {
                  scheduleStatus = "active";
                }

                const scheduleConfig = {
                  "active": { icon: CalendarCheck, label: "جارٍ الآن", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
                  "scheduled": { icon: CalendarClock, label: "مجدول", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
                  "expired": { icon: CalendarX, label: "منتهي", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
                  "no-schedule": { icon: Clock, label: "بدون جدولة", className: "bg-muted text-muted-foreground" },
                };
                const schedule = scheduleConfig[scheduleStatus];
                const ScheduleIcon = schedule.icon;

                return (
                  <Card key={ad.id} className={`transition-all ${!ad.is_active ? "opacity-60" : ""} ${scheduleStatus === "expired" ? "border-destructive/30" : ""}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {ad.image_url ? (
                          <img src={ad.image_url} alt={ad.title} className="w-20 h-20 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                            <Image className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-lg font-semibold truncate">{ad.title}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ad.is_active ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                              {ad.is_active ? "نشط" : "متوقف"}
                            </span>
                            {(startDate || endDate) && (
                              <Badge variant="outline" className={`text-[10px] gap-1 ${schedule.className} border-0`}>
                                <ScheduleIcon className="h-3 w-3" />
                                {schedule.label}
                              </Badge>
                            )}
                          </div>
                          {ad.description && <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{ad.description}</p>}
                          
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span className="bg-muted px-2 py-0.5 rounded">{placementOptions.find((p) => p.value === ad.placement)?.label || ad.placement}</span>
                            <span>الراعي: {ad.sponsor_name}</span>
                            <span>أولوية: {ad.priority}</span>
                            {ad.cta_url && (
                              <a href={ad.cta_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                                <ExternalLink className="h-3 w-3" /> {ad.cta_text}
                              </a>
                            )}
                          </div>

                          {(startDate || endDate) && (
                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground border-t pt-2">
                              {startDate && (
                                <span className="flex items-center gap-1">
                                  <CalendarCheck className="h-3 w-3" />
                                  يبدأ: {format(startDate, "dd MMM yyyy - HH:mm", { locale: ar })}
                                </span>
                              )}
                              {endDate && (
                                <span className={`flex items-center gap-1 ${scheduleStatus === "expired" ? "text-destructive" : ""}`}>
                                  <CalendarX className="h-3 w-3" />
                                  ينتهي: {format(endDate, "dd MMM yyyy - HH:mm", { locale: ar })}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-2 pl-4 border-l">
                            <Label htmlFor={`toggle-${ad.id}`} className="text-sm">
                              {ad.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </Label>
                            <Switch id={`toggle-${ad.id}`} checked={ad.is_active} onCheckedChange={() => toggleStatus(ad.id, ad.is_active)} />
                          </div>
                          <Button variant="outline" size="icon" onClick={() => handleEdit(ad)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => deleteAd(ad.id)}>
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

export default ManageNativeAds;

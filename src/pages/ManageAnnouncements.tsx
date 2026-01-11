import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Megaphone, Pencil, GripVertical, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";

interface Announcement {
  id: string;
  text: string;
  icon: string;
  is_active: boolean;
  sort_order: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

const iconOptions = [
  { value: "percent", label: "خصم %" },
  { value: "gift", label: "هدية" },
  { value: "truck", label: "شحن" },
  { value: "tag", label: "عرض" },
  { value: "sparkles", label: "مميز" },
  { value: "zap", label: "سريع" },
  { value: "star", label: "نجمة" },
  { value: "heart", label: "قلب" },
];

const ManageAnnouncements = () => {
  const { user, loading: authLoading } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    text: "",
    icon: "tag",
    sort_order: "0",
    end_date: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      checkAdminRole();
      fetchAnnouncements();
    }
  }, [user]);

  const checkAdminRole = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (data) {
      setIsAdmin(true);
    } else {
      toast({
        title: "غير مصرح",
        description: "هذه الصفحة مخصصة للمدراء فقط",
        variant: "destructive",
      });
      navigate("/");
    }
  };

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching announcements:", error);
    } else {
      setAnnouncements(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      text: "",
      icon: "tag",
      sort_order: "0",
      end_date: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const { error } = await supabase
          .from("announcements")
          .update({
            text: formData.text,
            icon: formData.icon,
            sort_order: parseInt(formData.sort_order),
            end_date: formData.end_date || null,
          })
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: "تم التحديث",
          description: "تم تحديث الإعلان بنجاح",
        });
      } else {
        const { error } = await supabase.from("announcements").insert({
          text: formData.text,
          icon: formData.icon,
          sort_order: parseInt(formData.sort_order),
          end_date: formData.end_date || null,
        });

        if (error) throw error;

        toast({
          title: "تم بنجاح",
          description: "تم إنشاء الإعلان",
        });
      }

      resetForm();
      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setFormData({
      text: announcement.text,
      icon: announcement.icon,
      sort_order: announcement.sort_order.toString(),
      end_date: announcement.end_date ? announcement.end_date.slice(0, 16) : "",
    });
    setEditingId(announcement.id);
    setShowForm(true);
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("announcements")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchAnnouncements();
      toast({
        title: currentStatus ? "تم إلغاء التفعيل" : "تم التفعيل",
        description: currentStatus ? "تم إخفاء الإعلان" : "تم إظهار الإعلان",
      });
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الإعلان؟")) return;

    const { error } = await supabase
      .from("announcements")
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
        description: "تم حذف الإعلان بنجاح",
      });
      fetchAnnouncements();
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

  if (!isAdmin) {
    return null;
  }

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
                <h1 className="text-3xl font-bold">إدارة الإعلانات</h1>
              </div>
              <p className="text-muted-foreground">إنشاء وتعديل إعلانات الشريط العلوي</p>
            </div>
            <Button onClick={() => {
              if (showForm && editingId) {
                resetForm();
              } else {
                setShowForm(!showForm);
              }
            }}>
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
                    <Label htmlFor="text">نص الإعلان *</Label>
                    <Input
                      id="text"
                      value={formData.text}
                      onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                      required
                      placeholder="🔥 خصم 50% على جميع المنتجات!"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="icon">الأيقونة</Label>
                      <Select
                        value={formData.icon}
                        onValueChange={(value) => setFormData({ ...formData, icon: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {iconOptions.map((icon) => (
                            <SelectItem key={icon.value} value={icon.value}>
                              {icon.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sort_order">ترتيب العرض</Label>
                      <Input
                        id="sort_order"
                        type="number"
                        value={formData.sort_order}
                        onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end_date">تاريخ انتهاء العرض (اختياري)</Label>
                    <Input
                      id="end_date"
                      type="datetime-local"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      {editingId ? "حفظ التعديلات" : "إنشاء الإعلان"}
                    </Button>
                    {editingId && (
                      <Button type="button" variant="outline" onClick={resetForm}>
                        إلغاء التعديل
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {announcements.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Megaphone className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-muted-foreground">لا توجد إعلانات بعد</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setShowForm(true)}
                  >
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة أول إعلان
                  </Button>
                </CardContent>
              </Card>
            ) : (
              announcements.map((announcement, index) => (
                <Card 
                  key={announcement.id} 
                  className={`transition-all ${!announcement.is_active ? 'opacity-60' : ''}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <GripVertical className="h-5 w-5" />
                        <span className="text-sm font-medium">#{announcement.sort_order}</span>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-lg font-medium">{announcement.text}</p>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            announcement.is_active 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {announcement.is_active ? 'نشط' : 'متوقف'}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="font-medium">الأيقونة:</span>
                            {iconOptions.find(i => i.value === announcement.icon)?.label || announcement.icon}
                          </span>
                          {announcement.end_date && (
                            <span>
                              ينتهي: {format(new Date(announcement.end_date), "dd MMM yyyy HH:mm", { locale: ar })}
                            </span>
                          )}
                          <span>
                            أُنشئ: {format(new Date(announcement.created_at), "dd MMM yyyy", { locale: ar })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 pl-4 border-l">
                          <Label htmlFor={`toggle-${announcement.id}`} className="text-sm">
                            {announcement.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Label>
                          <Switch
                            id={`toggle-${announcement.id}`}
                            checked={announcement.is_active}
                            onCheckedChange={() => toggleStatus(announcement.id, announcement.is_active)}
                          />
                        </div>
                        
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(announcement)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => deleteAnnouncement(announcement.id)}
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

export default ManageAnnouncements;

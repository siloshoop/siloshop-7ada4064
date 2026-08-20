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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, Loader2, Edit, Trash2, ArrowRight, Layers,
  Footprints, Baby, Sofa, Gamepad2, Sparkles, ShoppingBag, Dumbbell, BookOpen, Gem,
  User, HeartHandshake, Sun, Briefcase, GraduationCap, Bed, Square, Armchair,
  Archive, Monitor, Heart, Car, Palette, Scissors, Droplet, Wand2, Backpack,
  Luggage, Wallet, Laptop, Shirt, Circle, Waves, Bike, BookMarked, Library,
  Star, Link as LinkIcon, Watch
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Explicit map instead of `import * as LucideIcons` — a namespace import pulls
// the entire icon library (~700 kB) into this route's bundle.
const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  Footprints, User, Baby, HeartHandshake, Sun, Briefcase, Dumbbell,
  GraduationCap, Bed, Sofa, Square, Armchair, Archive, Monitor,
  BookOpen, Gamepad2, Heart, Car, Palette, Sparkles, Scissors,
  Droplet, Wand2, ShoppingBag, Backpack, Luggage, Wallet, Laptop,
  Shirt, Circle, Waves, Bike, BookMarked, Library, Star, Link: LinkIcon,
  Watch, Layers, Gem,
};

const iconOptions = [
  "Footprints", "User", "Baby", "HeartHandshake", "Sun", "Briefcase", "Dumbbell",
  "GraduationCap", "Bed", "Sofa", "Square", "Armchair", "Archive", "Monitor",
  "BookOpen", "Gamepad2", "Heart", "Car", "Palette", "Sparkles", "Scissors",
  "Droplet", "Wand2", "ShoppingBag", "Backpack", "Luggage", "Wallet", "Laptop",
  "Shirt", "Circle", "Waves", "Bike", "BookMarked", "Library", "Star", "Link", "Watch"
];

const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const ManageSubcategories = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name_ar: "",
    name_en: "",
    category_id: "",
    icon: "Circle",
    description: "",
    sort_order: 0,
    is_active: true,
    slug: "",
    image_url: "",
    banner_url: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    parent_subcategory_id: "" as string | null,
  });
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
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        setProfile(profileData);

        if (profileData?.role !== "vendor") {
          navigate("/dashboard");
          return;
        }

        const { data: categoriesData } = await supabase
          .from("categories")
          .select("*")
          .order("name_ar");

        setCategories(categoriesData || []);

        const { data: subcategoriesData } = await supabase
          .from("subcategories")
          .select("*, categories(name_ar)")
          .order("sort_order");

        setSubcategories(subcategoriesData || []);
      } catch (error) {
        toast({
          title: "خطأ",
          description: "فشل في جلب البيانات",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, toast, navigate]);

  const filteredSubcategories = selectedCategory === "all"
    ? subcategories
    : subcategories.filter(s => s.category_id === selectedCategory);

  const handleOpenDialog = (subcategory?: any) => {
    if (subcategory) {
      setEditingSubcategory(subcategory);
      setFormData({
        name_ar: subcategory.name_ar,
        name_en: subcategory.name_en || "",
        category_id: subcategory.category_id,
        icon: subcategory.icon || "Circle",
        description: subcategory.description || "",
        sort_order: subcategory.sort_order || 0,
        is_active: subcategory.is_active,
        slug: subcategory.slug || "",
        image_url: subcategory.image_url || "",
        banner_url: subcategory.banner_url || "",
        seo_title: subcategory.seo_title || "",
        seo_description: subcategory.seo_description || "",
        seo_keywords: subcategory.seo_keywords || "",
        parent_subcategory_id: subcategory.parent_subcategory_id || "",
      });
    } else {
      setEditingSubcategory(null);
      setFormData({
        name_ar: "",
        name_en: "",
        category_id: categories[0]?.id || "",
        icon: "Circle",
        description: "",
        sort_order: 0,
        is_active: true,
        slug: "",
        image_url: "",
        banner_url: "",
        seo_title: "",
        seo_description: "",
        seo_keywords: "",
        parent_subcategory_id: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name_ar || !formData.category_id) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      ...formData,
      slug: formData.slug.trim() || slugify(formData.name_en || formData.name_ar),
      image_url: formData.image_url.trim() || null,
      banner_url: formData.banner_url.trim() || null,
      seo_title: formData.seo_title.trim() || null,
      seo_description: formData.seo_description.trim() || null,
      seo_keywords: formData.seo_keywords.trim() || null,
      parent_subcategory_id: formData.parent_subcategory_id || null,
    };

    try {
      if (editingSubcategory) {
        const { error } = await supabase
          .from("subcategories")
          .update(payload)
          .eq("id", editingSubcategory.id);

        if (error) throw error;

        setSubcategories(subcategories.map(s =>
          s.id === editingSubcategory.id ? { ...s, ...payload } : s
        ));

        toast({
          title: "تم بنجاح",
          description: "تم تحديث التصنيف الفرعي",
        });
      } else {
        const { data, error } = await supabase
          .from("subcategories")
          .insert(payload)
          .select("*, categories(name_ar)")
          .single();

        if (error) throw error;

        setSubcategories([...subcategories, data]);

        toast({
          title: "تم بنجاح",
          description: "تم إضافة التصنيف الفرعي",
        });
      }

      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا التصنيف الفرعي؟")) return;

    try {
      const { error } = await supabase
        .from("subcategories")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSubcategories(subcategories.filter(s => s.id !== id));

      toast({
        title: "تم بنجاح",
        description: "تم حذف التصنيف الفرعي",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("subcategories")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      setSubcategories(subcategories.map(s =>
        s.id === id ? { ...s, is_active: !currentStatus } : s
      ));

      toast({
        title: "تم بنجاح",
        description: `تم ${!currentStatus ? "تفعيل" : "إلغاء تفعيل"} التصنيف الفرعي`,
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const renderIcon = (iconName: string) => {
    const IconComponent = iconComponents[iconName];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : <Layers className="h-4 w-4" />;
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
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowRight className="h-4 w-4 ml-1" />
            لوحة التحكم
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  إدارة التصنيفات الفرعية
                </CardTitle>
                <CardDescription>إضافة وتعديل التصنيفات الفرعية للمنتجات</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة تصنيف فرعي
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingSubcategory ? "تعديل التصنيف الفرعي" : "إضافة تصنيف فرعي جديد"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingSubcategory ? "قم بتعديل بيانات التصنيف الفرعي" : "أدخل بيانات التصنيف الفرعي الجديد"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="category_id">التصنيف الرئيسي *</Label>
                      <Select
                        value={formData.category_id}
                        onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر التصنيف" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name_ar}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name_ar">الاسم بالعربية *</Label>
                      <Input
                        id="name_ar"
                        value={formData.name_ar}
                        onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                        placeholder="مثال: أحذية رجالية"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name_en">الاسم بالإنجليزية</Label>
                      <Input
                        id="name_en"
                        value={formData.name_en}
                        onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                        placeholder="Example: Men Shoes"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="icon">الأيقونة</Label>
                      <Select
                        value={formData.icon}
                        onValueChange={(value) => setFormData({ ...formData, icon: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الأيقونة" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {iconOptions.map((icon) => (
                            <SelectItem key={icon} value={icon}>
                              <div className="flex items-center gap-2">
                                {renderIcon(icon)}
                                <span>{icon}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">الوصف</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="وصف اختياري للتصنيف"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slug">الرابط المختصر (slug)</Label>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        placeholder={formData.name_en ? slugify(formData.name_en) : "يُنشأ تلقائيًا"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="parent_subcategory_id">التصنيف الفرعي الأب</Label>
                      <Select
                        value={formData.parent_subcategory_id || "none"}
                        onValueChange={(value) => setFormData({ ...formData, parent_subcategory_id: value === "none" ? "" : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="بدون (تصنيف فرعي رئيسي)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">بدون (تصنيف فرعي رئيسي)</SelectItem>
                          {subcategories
                            .filter((s) => s.category_id === formData.category_id && s.id !== editingSubcategory?.id)
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name_ar}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="image_url">رابط الصورة</Label>
                      <Input
                        id="image_url"
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="banner_url">رابط صورة البانر</Label>
                      <Input
                        id="banner_url"
                        value={formData.banner_url}
                        onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="seo_title">عنوان SEO</Label>
                      <Input
                        id="seo_title"
                        value={formData.seo_title}
                        onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                        placeholder="عنوان الصفحة لمحركات البحث"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="seo_description">وصف SEO</Label>
                      <Input
                        id="seo_description"
                        value={formData.seo_description}
                        onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                        placeholder="وصف الصفحة لمحركات البحث"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="seo_keywords">الكلمات المفتاحية</Label>
                      <Input
                        id="seo_keywords"
                        value={formData.seo_keywords}
                        onChange={(e) => setFormData({ ...formData, seo_keywords: e.target.value })}
                        placeholder="كلمات مفصولة بفواصل"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sort_order">الترتيب</Label>
                      <Input
                        id="sort_order"
                        type="number"
                        value={formData.sort_order}
                        onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="is_active">نشط</Label>
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button type="submit" className="flex-1">
                        {editingSubcategory ? "حفظ التغييرات" : "إضافة"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        إلغاء
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="فلترة حسب التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع التصنيفات</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filteredSubcategories.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الأيقونة</TableHead>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">التصنيف الرئيسي</TableHead>
                      <TableHead className="text-right">الترتيب</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubcategories.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            {renderIcon(sub.icon || "Circle")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{sub.name_ar}</div>
                            {sub.name_en && (
                              <div className="text-sm text-muted-foreground">{sub.name_en}</div>
                            )}
                            {sub.slug && (
                              <div className="text-xs text-muted-foreground">/{sub.slug}</div>
                            )}
                            {sub.parent_subcategory_id && (
                              <div className="text-xs text-muted-foreground">
                                فرعي من: {subcategories.find((p) => p.id === sub.parent_subcategory_id)?.name_ar || "—"}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {sub.categories?.name_ar || "غير محدد"}
                          </Badge>
                        </TableCell>
                        <TableCell>{sub.sort_order}</TableCell>
                        <TableCell>
                          <Switch
                            checked={sub.is_active}
                            onCheckedChange={() => handleToggleActive(sub.id, sub.is_active)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDialog(sub)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(sub.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                لا توجد تصنيفات فرعية
              </p>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default ManageSubcategories;

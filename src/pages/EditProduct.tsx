import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Trash2, ChevronLeft } from "lucide-react";
import imageCompression from 'browser-image-compression';

const EditProduct = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    original_price: "",
    stock_quantity: "",
    shipping_cost: "0",
    ships_within_days: "",
    video_url: "",
    category_id: "",
    subcategory_id: "",
    is_active: true,
  });

  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories and subcategories
        const [{ data: categoriesData }, { data: subcategoriesData }] = await Promise.all([
          supabase.from("categories").select("*").order("name_ar"),
          supabase.from("subcategories").select("*").eq("is_active", true).order("sort_order")
        ]);
        setCategories(categoriesData || []);
        setSubcategories(subcategoriesData || []);

        // Fetch product
        if (id && user) {
          const { data: product, error } = await supabase
            .from("products")
            .select("*")
            .eq("id", id)
            .eq("vendor_id", user.id)
            .single();

          if (error) throw error;

          if (product) {
            setFormData({
              name: product.name,
              description: product.description || "",
              price: product.price.toString(),
              original_price: product.original_price?.toString() || "",
              stock_quantity: product.stock_quantity?.toString() || "0",
              shipping_cost: (product as any).shipping_cost?.toString() || "0",
              ships_within_days: (product as any).ships_within_days?.toString() || "",
              video_url: (product as any).video_url || "",
              category_id: product.category_id || "",
              subcategory_id: product.subcategory_id || "",
              is_active: product.is_active ?? true,
            });

            // Set existing images
            const images = product.images || [];
            if (product.image_url && !images.includes(product.image_url)) {
              images.unshift(product.image_url);
            }
            setExistingImages(images);
          }
        }
      } catch (error) {
        toast({
          title: "خطأ",
          description: error.message,
          variant: "destructive",
        });
        navigate("/dashboard");
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [id, user, navigate, toast]);

  // Filter subcategories when category changes
  useEffect(() => {
    if (formData.category_id) {
      const filtered = subcategories.filter(s => s.category_id === formData.category_id);
      setFilteredSubcategories(filtered);
    } else {
      setFilteredSubcategories([]);
    }
  }, [formData.category_id, subcategories]);

  const handleCategoryChange = (value: string) => {
    setFormData(prev => ({ 
      ...prev, 
      category_id: value,
      subcategory_id: "" // Reset subcategory when category changes
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const totalImages = existingImages.length + newFiles.length + files.length;
    if (totalImages > 5) {
      toast({
        title: "خطأ",
        description: "يمكنك رفع 5 صور كحد أقصى",
        variant: "destructive",
      });
      return;
    }

    const validatedFiles: File[] = [];
    const previews: string[] = [];

    for (const file of files) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "خطأ",
          description: `نوع الملف ${file.name} غير مدعوم`,
          variant: "destructive",
        });
        continue;
      }

      if (file.size > 5242880) {
        toast({
          title: "خطأ",
          description: `حجم الملف ${file.name} كبير جداً`,
          variant: "destructive",
        });
        continue;
      }

      try {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: file.type as any,
        };

        const compressedFile = await imageCompression(file, options);
        validatedFiles.push(compressedFile);
        previews.push(URL.createObjectURL(compressedFile));
      } catch (error) {
        validatedFiles.push(file);
        previews.push(URL.createObjectURL(file));
      }
    }

    if (validatedFiles.length > 0) {
      setNewFiles([...newFiles, ...validatedFiles]);
      setNewPreviews([...newPreviews, ...previews]);
      
      toast({
        title: "تم بنجاح",
        description: `تم إضافة ${validatedFiles.length} صورة`,
      });
    }
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setNewFiles(newFiles.filter((_, i) => i !== index));
    setNewPreviews(newPreviews.filter((_, i) => i !== index));
  };

  const uploadNewImages = async (): Promise<string[]> => {
    if (newFiles.length === 0 || !user) return [];

    const uploadedUrls: string[] = [];

    for (const file of newFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    setLoading(true);
    try {
      // Upload new images
      const newImageUrls = await uploadNewImages();
      
      // Combine existing and new images
      const allImages = [...existingImages, ...newImageUrls];

      if (allImages.length === 0) {
        toast({
          title: "خطأ",
          description: "يرجى اختيار صورة واحدة على الأقل للمنتج",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("products")
        .update({
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          original_price: formData.original_price ? parseFloat(formData.original_price) : null,
          stock_quantity: parseInt(formData.stock_quantity),
          shipping_cost: parseFloat(formData.shipping_cost) || 0,
          ships_within_days: formData.ships_within_days ? parseInt(formData.ships_within_days) : null,
          video_url: formData.video_url.trim() || null,
          category_id: formData.category_id || null,
          subcategory_id: formData.subcategory_id || null,
          image_url: allImages[0],
          images: allImages,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id)
        .eq("vendor_id", user.id);

      if (error) throw error;

      toast({
        title: "تم بنجاح",
        description: "تم تحديث المنتج بنجاح",
      });

      navigate("/dashboard");
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !id) return;
    
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;

    setLoading(true);
    const { data, error } = await supabase.rpc("delete_or_archive_product", {
      _product_id: id,
    });
    setLoading(false);

    if (error) {
      toast({
        title: "تعذّر تنفيذ العملية",
        description: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: data === "deleted" ? "تم الحذف" : "تمت الأرشفة",
      description:
        data === "deleted"
          ? "تم حذف المنتج نهائياً."
          : "لا يمكن حذف هذا المنتج نهائياً لأنه مرتبط بطلبات عملاء موجودة. تمت أرشفته بدلاً من ذلك.",
    });

    navigate("/dashboard");
  };

  if (authLoading || fetching) {
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
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl">تعديل المنتج</CardTitle>
            <CardDescription>تحديث معلومات وصور المنتج</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">اسم المنتج *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="أدخل اسم المنتج"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">الوصف</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف تفصيلي للمنتج"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">السعر *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="original_price">السعر الأصلي (اختياري)</Label>
                  <Input
                    id="original_price"
                    type="number"
                    step="0.01"
                    value={formData.original_price}
                    onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shipping_cost">تكلفة الشحن (ل.س)</Label>
                <Input
                  id="shipping_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.shipping_cost}
                  onChange={(e) => setFormData({ ...formData, shipping_cost: e.target.value })}
                  placeholder="0 = شحن مجاني"
                />
                <p className="text-xs text-muted-foreground">اتركه 0 للشحن المجاني</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ships_within_days">مدة التجهيز والشحن (أيام)</Label>
                <Input
                  id="ships_within_days"
                  type="number"
                  min="0"
                  max="60"
                  value={formData.ships_within_days}
                  onChange={(e) => setFormData({ ...formData, ships_within_days: e.target.value })}
                  placeholder="مثال: 3"
                />
                <p className="text-xs text-muted-foreground">تُعرض للمشتري كـ «يشحن خلال X أيام».</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="video_url">رابط فيديو المنتج (اختياري)</Label>
                <Input
                  id="video_url"
                  type="url"
                  inputMode="url"
                  value={formData.video_url}
                  onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                  placeholder="https://youtube.com/watch?v=... أو رابط mp4"
                />
                <p className="text-xs text-muted-foreground">
                  يظهر الفيديو داخل معرض صور المنتج (يوتيوب، فيميو، أو ملف mp4).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock_quantity">الكمية المتوفرة *</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  required
                  placeholder="0"
                />
              </div>

              {/* Category Selection - Amazon Style */}
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <ChevronLeft className="h-5 w-5" />
                  تصنيف المنتج
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">الفئة الرئيسية</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={handleCategoryChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الفئة الرئيسية" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name_ar}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subcategory">التصنيف الفرعي</Label>
                    <Select
                      value={formData.subcategory_id}
                      onValueChange={(value) => setFormData({ ...formData, subcategory_id: value })}
                      disabled={!formData.category_id || filteredSubcategories.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          !formData.category_id 
                            ? "اختر الفئة أولاً" 
                            : filteredSubcategories.length === 0 
                              ? "لا توجد تصنيفات فرعية" 
                              : "اختر التصنيف الفرعي"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSubcategories.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name_ar}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.category_id && formData.subcategory_id && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background p-2 rounded">
                    <span>المسار:</span>
                    <span className="font-medium text-foreground">
                      {categories.find(c => c.id === formData.category_id)?.name_ar}
                    </span>
                    <ChevronLeft className="h-4 w-4" />
                    <span className="font-medium text-primary">
                      {filteredSubcategories.find(s => s.id === formData.subcategory_id)?.name_ar}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>الصور الحالية</Label>
                {existingImages.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {existingImages.map((img, index) => (
                      <div key={index} className="relative">
                        <img
                          src={img}
                          alt={`صورة ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 left-2"
                          onClick={() => removeExistingImage(index)}
                        >
                          حذف
                        </Button>
                        {index === 0 && (
                          <div className="absolute bottom-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                            صورة رئيسية
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">لا توجد صور حالية</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-images">إضافة صور جديدة</Label>
                <Input
                  id="new-images"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                  multiple
                  disabled={existingImages.length + newFiles.length >= 5}
                />
                <p className="text-sm text-muted-foreground">
                  يمكنك رفع حتى {5 - existingImages.length - newFiles.length} صور إضافية
                </p>

                {newPreviews.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                    {newPreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`صورة جديدة ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 left-2"
                          onClick={() => removeNewImage(index)}
                        >
                          حذف
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <Button type="submit" className="flex-1" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Save className="ml-2 h-5 w-5" />
                      حفظ التغييرات
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  disabled={loading}
                >
                  إلغاء
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default EditProduct;
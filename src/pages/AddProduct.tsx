import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, ChevronLeft, X } from "lucide-react";
import imageCompression from 'browser-image-compression';
import { productNumbersSchema, firstIssue, friendlyDbError } from "@/lib/productValidation";

const SHIPPING_CLASSES = [
  { value: "عادي", label: "عادي" },
  { value: "قابل للكسر", label: "قابل للكسر" },
  { value: "ثقيل", label: "ثقيل" },
  { value: "سريع التلف", label: "سريع التلف" },
];

const slugify = (input: string) =>
  input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "");

const AddProduct = () => {
  const { user, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    name_en: "",
    description: "",
    short_description: "",
    price: "",
    original_price: "",
    stock_quantity: "",
    min_order_quantity: "1",
    max_order_quantity: "",
    shipping_cost: "0",
    ships_within_days: "",
    video_url: "",
    category_id: "",
    subcategory_id: "",
    image_url: "",
    gtin: "",
    length_cm: "",
    width_cm: "",
    height_cm: "",
    shipping_weight: "",
    shipping_class: "",
    warranty: "",
    return_policy: "",
    country_of_origin: "",
    slug: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
  });

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: categoriesData }, { data: subcategoriesData }] = await Promise.all([
        supabase.from("categories").select("*").order("name_ar"),
        supabase.from("subcategories").select("*").eq("is_active", true).order("sort_order")
      ]);
      setCategories(categoriesData || []);
      setSubcategories(subcategoriesData || []);
    };
    fetchData();
  }, []);

  // Filter subcategories when category changes
  useEffect(() => {
    if (formData.category_id) {
      const filtered = subcategories.filter(s => s.category_id === formData.category_id);
      setFilteredSubcategories(filtered);
      // Reset subcategory if it doesn't belong to the new category
      if (formData.subcategory_id && !filtered.find(s => s.id === formData.subcategory_id)) {
        setFormData(prev => ({ ...prev, subcategory_id: "" }));
      }
    } else {
      setFilteredSubcategories([]);
      setFormData(prev => ({ ...prev, subcategory_id: "" }));
    }
  }, [formData.category_id, subcategories]);

  const addTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    if (tags.includes(value)) {
      setTagInput("");
      return;
    }
    setTags([...tags, value]);
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (selectedFiles.length + files.length > 5) {
      toast({
        title: "خطأ",
        description: "يمكنك رفع 5 صور كحد أقصى",
        variant: "destructive",
      });
      return;
    }

    const validatedFiles: File[] = [];
    const newPreviews: string[] = [];

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
        newPreviews.push(URL.createObjectURL(compressedFile));
      } catch (error) {
        console.error('Error compressing image:', error);
        validatedFiles.push(file);
        newPreviews.push(URL.createObjectURL(file));
      }
    }

    if (validatedFiles.length > 0) {
      setSelectedFiles([...selectedFiles, ...validatedFiles]);
      setImagePreviews([...imagePreviews, ...newPreviews]);
      
      toast({
        title: "تم بنجاح",
        description: `تم إضافة ${validatedFiles.length} صورة`,
      });
    }
  };

  const removeImage = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (selectedFiles.length === 0 || !user) return [];

    const uploadedUrls: string[] = [];

    for (const file of selectedFiles) {
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

  const handleSubmit = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const parsed = productNumbersSchema.safeParse({
        name: formData.name,
        price: formData.price,
        original_price: formData.original_price,
        shipping_cost: formData.shipping_cost,
        stock_quantity: formData.stock_quantity,
        ships_within_days: formData.ships_within_days,
      });

      if (!parsed.success) {
        toast({ title: "بيانات غير صالحة", description: firstIssue(parsed.error), variant: "destructive" });
        setLoading(false);
        return;
      }
      const values = parsed.data;

      if (formData.short_description && formData.short_description.length > 300) {
        toast({ title: "بيانات غير صالحة", description: "الوصف المختصر يجب ألا يتجاوز 300 حرف", variant: "destructive" });
        setLoading(false);
        return;
      }

      const minQty = formData.min_order_quantity ? parseInt(formData.min_order_quantity, 10) : 1;
      const maxQty = formData.max_order_quantity ? parseInt(formData.max_order_quantity, 10) : null;
      if (maxQty !== null && minQty !== null && maxQty < minQty) {
        toast({
          title: "بيانات غير صالحة",
          description: "الحد الأقصى للطلب يجب أن يكون أكبر من أو يساوي الحد الأدنى",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const finalSlug = formData.slug.trim()
        ? slugify(formData.slug)
        : slugify(formData.name_en || formData.name);

      let imageUrls: string[] = [];
      let mainImageUrl = formData.image_url;

      if (selectedFiles.length > 0) {
        imageUrls = await uploadImages();
        mainImageUrl = imageUrls[0];
      }

      if (!mainImageUrl && imageUrls.length === 0) {
        toast({
          title: "خطأ",
          description: "يرجى اختيار صورة واحدة على الأقل للمنتج",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("products").insert({
        vendor_id: user.id,
        name: values.name,
        name_en: formData.name_en.trim() || null,
        description: formData.description,
        short_description: formData.short_description.trim() || null,
        price: values.price,
        original_price: values.original_price ?? null,
        stock_quantity: values.stock_quantity,
        min_order_quantity: minQty,
        max_order_quantity: maxQty,
        shipping_cost: values.shipping_cost ?? 0,
        ships_within_days: values.ships_within_days ?? null,
        video_url: formData.video_url.trim() || null,
        category_id: formData.category_id || null,
        subcategory_id: formData.subcategory_id || null,
        image_url: mainImageUrl,
        images: imageUrls.length > 0 ? imageUrls : null,
        gtin: formData.gtin.trim() || null,
        length_cm: formData.length_cm ? Number(formData.length_cm) : null,
        width_cm: formData.width_cm ? Number(formData.width_cm) : null,
        height_cm: formData.height_cm ? Number(formData.height_cm) : null,
        shipping_weight: formData.shipping_weight ? Number(formData.shipping_weight) : null,
        shipping_class: formData.shipping_class || null,
        warranty: formData.warranty.trim() || null,
        return_policy: formData.return_policy.trim() || null,
        country_of_origin: formData.country_of_origin.trim() || null,
        tags: tags.length > 0 ? tags : [],
        slug: finalSlug || null,
        seo_title: formData.seo_title.trim() || null,
        seo_description: formData.seo_description.trim() || null,
        seo_keywords: formData.seo_keywords.trim() || null,
        is_active: !asDraft,
        moderation_status: asDraft ? "draft" : "pending",
      } as any);

      if (error) throw error;

      toast({
        title: "تم بنجاح",
        description: asDraft
          ? "تم حفظ المنتج كمسودة. يمكنك إرساله للمراجعة لاحقاً."
          : "تم إرسال المنتج للمراجعة",
      });

      navigate("/dashboard");
    } catch (error) {
      toast({
        title: "خطأ",
        description: friendlyDbError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
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
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl">إضافة منتج جديد</CardTitle>
            <CardDescription>أضف منتجاً جديداً إلى متجرك</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Accordion type="multiple" defaultValue={["basic"]} className="w-full">
                <AccordionItem value="basic">
                  <AccordionTrigger>معلومات أساسية</AccordionTrigger>
                  <AccordionContent className="space-y-4">
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
                      <Label htmlFor="name_en">اسم المنتج بالإنجليزية (اختياري)</Label>
                      <Input
                        id="name_en"
                        value={formData.name_en}
                        onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                        placeholder="Product name in English"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="short_description">وصف مختصر (حتى 300 حرف)</Label>
                      <Textarea
                        id="short_description"
                        value={formData.short_description}
                        onChange={(e) => setFormData({ ...formData, short_description: e.target.value.slice(0, 300) })}
                        placeholder="ملخص قصير يظهر في نتائج البحث"
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground text-left">
                        {formData.short_description.length}/300
                      </p>
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
                            onValueChange={(value) => setFormData({ ...formData, category_id: value })}
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
                      <Label htmlFor="image">صور المنتج * (حتى 5 صور)</Label>
                      <div className="space-y-4">
                        <Input
                          id="image"
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                          onChange={handleFileChange}
                          className="cursor-pointer"
                          multiple
                        />
                        <p className="text-sm text-muted-foreground">
                          الحد الأقصى: 5 صور، 5 ميجابايت لكل صورة. الصيغ المدعومة: JPG, PNG, WEBP, GIF
                        </p>

                        {imagePreviews.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {imagePreviews.map((preview, index) => (
                              <div key={index} className="relative">
                                <img
                                  src={preview}
                                  alt={`معاينة ${index + 1}`}
                                  className="w-full h-32 object-cover rounded-lg"
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="absolute top-2 left-2"
                                  onClick={() => removeImage(index)}
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
                        )}

                        <div className="pt-2 border-t">
                          <Label htmlFor="image_url" className="text-sm">أو أدخل رابط صورة رئيسية</Label>
                          <Input
                            id="image_url"
                            type="url"
                            value={formData.image_url}
                            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                            placeholder="https://example.com/image.jpg"
                            className="mt-2"
                          />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="pricing">
                  <AccordionTrigger>السعر والمخزون</AccordionTrigger>
                  <AccordionContent className="space-y-4">
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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="min_order_quantity">الحد الأدنى للطلب</Label>
                        <Input
                          id="min_order_quantity"
                          type="number"
                          min="1"
                          value={formData.min_order_quantity}
                          onChange={(e) => setFormData({ ...formData, min_order_quantity: e.target.value })}
                          placeholder="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max_order_quantity">الحد الأقصى للطلب (اختياري)</Label>
                        <Input
                          id="max_order_quantity"
                          type="number"
                          min="1"
                          value={formData.max_order_quantity}
                          onChange={(e) => setFormData({ ...formData, max_order_quantity: e.target.value })}
                          placeholder="بدون حد"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="shipping">
                  <AccordionTrigger>الشحن والأبعاد</AccordionTrigger>
                  <AccordionContent className="space-y-4">
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
                      <p className="text-xs text-muted-foreground">
                        تُعرض للمشتري كـ «يشحن خلال X أيام». اتركه فارغاً إن لم تكن متأكداً.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="length_cm">الطول (سم)</Label>
                        <Input
                          id="length_cm"
                          type="number"
                          step="0.01"
                          value={formData.length_cm}
                          onChange={(e) => setFormData({ ...formData, length_cm: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="width_cm">العرض (سم)</Label>
                        <Input
                          id="width_cm"
                          type="number"
                          step="0.01"
                          value={formData.width_cm}
                          onChange={(e) => setFormData({ ...formData, width_cm: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="height_cm">الارتفاع (سم)</Label>
                        <Input
                          id="height_cm"
                          type="number"
                          step="0.01"
                          value={formData.height_cm}
                          onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shipping_weight">وزن الشحن (كغ)</Label>
                        <Input
                          id="shipping_weight"
                          type="number"
                          step="0.001"
                          value={formData.shipping_weight}
                          onChange={(e) => setFormData({ ...formData, shipping_weight: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shipping_class">فئة الشحن</Label>
                        <Select
                          value={formData.shipping_class}
                          onValueChange={(value) => setFormData({ ...formData, shipping_class: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر فئة الشحن" />
                          </SelectTrigger>
                          <SelectContent>
                            {SHIPPING_CLASSES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="warranty">الضمان</Label>
                      <Input
                        id="warranty"
                        value={formData.warranty}
                        onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                        placeholder="مثال: سنة واحدة ضمان الوكيل"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="return_policy">سياسة الإرجاع</Label>
                      <Textarea
                        id="return_policy"
                        value={formData.return_policy}
                        onChange={(e) => setFormData({ ...formData, return_policy: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country_of_origin">بلد المنشأ</Label>
                      <Input
                        id="country_of_origin"
                        value={formData.country_of_origin}
                        onChange={(e) => setFormData({ ...formData, country_of_origin: e.target.value })}
                        placeholder="مثال: سوريا"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="specs">
                  <AccordionTrigger>المواصفات</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="gtin">الرمز الدولي GTIN</Label>
                      <Input
                        id="gtin"
                        value={formData.gtin}
                        onChange={(e) => setFormData({ ...formData, gtin: e.target.value })}
                        placeholder="مثال: 0123456789012"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tags">الوسوم (اضغط Enter أو فاصلة للإضافة)</Label>
                      <Input
                        id="tags"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        onBlur={addTag}
                        placeholder="اكتب وسماً ثم اضغط Enter"
                      />
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="gap-1">
                              {tag}
                              <button type="button" onClick={() => removeTag(tag)} aria-label="حذف الوسم">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="seo">
                  <AccordionTrigger>SEO</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="slug">الرابط المختصر (Slug)</Label>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        placeholder="سيتم اشتقاقه تلقائياً من اسم المنتج إن تُرك فارغاً"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="seo_title">عنوان SEO</Label>
                      <Input
                        id="seo_title"
                        value={formData.seo_title}
                        onChange={(e) => setFormData({ ...formData, seo_title: e.target.value.slice(0, 60) })}
                      />
                      <p className="text-xs text-muted-foreground text-left">{formData.seo_title.length}/60</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="seo_description">وصف SEO</Label>
                      <Textarea
                        id="seo_description"
                        value={formData.seo_description}
                        onChange={(e) => setFormData({ ...formData, seo_description: e.target.value.slice(0, 160) })}
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground text-left">{formData.seo_description.length}/160</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="seo_keywords">كلمات مفتاحية (مفصولة بفاصلة)</Label>
                      <Input
                        id="seo_keywords"
                        value={formData.seo_keywords}
                        onChange={(e) => setFormData({ ...formData, seo_keywords: e.target.value })}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="variants">
                  <AccordionTrigger>الخيارات والمتغيرات</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      يمكنك إضافة متغيرات المنتج (مثل الألوان والمقاسات) بعد حفظ المنتج، من صفحة تعديل المنتج.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="flex gap-4">
                <Button type="submit" className="flex-1" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                      جاري الإضافة...
                    </>
                  ) : (
                    <>
                      <Upload className="ml-2 h-5 w-5" />
                      إرسال للمراجعة
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  disabled={loading}
                  onClick={(e) => handleSubmit(e as any, true)}
                >
                  حفظ كمسودة
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  disabled={loading}
                >
                  إلغاء
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

export default AddProduct;

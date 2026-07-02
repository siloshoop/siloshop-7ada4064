import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Loader2, X, Star, Package, DollarSign, Tag, ShoppingCart, 
  User, Check, Minus, TrendingDown, Scale, Trash2, Share2, Copy, Bookmark, FolderOpen, Download, Image, FileText 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FavoriteButton } from "@/components/FavoriteButton";
import { useCompareProducts } from "@/hooks/useCompareProducts";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  description: string | null;
  stock_quantity: number | null;
  vendor_id: string;
  categories: {
    name_ar: string;
  } | null;
  subcategories: {
    name_ar: string;
  } | null;
  reviews: {
    rating: number;
  }[];
  vendor: {
    full_name: string;
  } | null;
}

interface ComparisonRow {
  label: string;
  icon: React.ReactNode;
  getValue: (product: Product) => React.ReactNode;
  highlight?: "lowest" | "highest";
}

interface SavedComparison {
  id: string;
  name: string;
  product_ids: string[];
  created_at: string;
}

const Compare = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [savedComparisons, setSavedComparisons] = useState<SavedComparison[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savedDialogOpen, setSavedDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const comparisonRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { clearProducts } = useCompareProducts();

  const handleExportAsImage = async () => {
    if (!comparisonRef.current) return;
    
    setExporting(true);
    try {
      const canvas = await html2canvas(comparisonRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      
      const link = document.createElement("a");
      link.download = `comparison-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      
      toast({
        title: "تم التصدير",
        description: "تم تصدير المقارنة كصورة بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل تصدير المقارنة كصورة",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportAsPDF = async () => {
    if (!comparisonRef.current) return;
    
    setExporting(true);
    try {
      const canvas = await html2canvas(comparisonRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`comparison-${Date.now()}.pdf`);
      
      toast({
        title: "تم التصدير",
        description: "تم تصدير المقارنة كـ PDF بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل تصدير المقارنة كـ PDF",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      fetchSavedComparisons();
    }
  }, [user]);

  const fetchProducts = async () => {
    const productIds = searchParams.get("products")?.split(",") || [];
    
    if (productIds.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          categories(name_ar),
          subcategories(name_ar),
          reviews(rating)
        `)
        .in("id", productIds)
        .eq("is_active", true);

      if (error) throw error;

      const productsWithVendors = await Promise.all(
        (data || []).map(async (product) => {
          const { data: vendorInfo } = await supabase
            .rpc("get_vendor_public_info", { vendor_id: product.vendor_id });
          return {
            ...product,
            vendor: vendorInfo?.[0] || null,
          };
        })
      );

      setProducts(productsWithVendors as Product[]);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل المنتجات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedComparisons = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("saved_comparisons")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSavedComparisons(data);
    }
  };

  const handleSaveComparison = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (products.length === 0) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("saved_comparisons").insert({
        user_id: user.id,
        name: saveName || `مقارنة ${new Date().toLocaleDateString("ar")}`,
        product_ids: products.map((p) => p.id),
      });

      if (error) throw error;

      toast({
        title: "تم الحفظ",
        description: "تم حفظ المقارنة بنجاح",
      });

      setSaveDialogOpen(false);
      setSaveName("");
      fetchSavedComparisons();
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLoadComparison = (comparison: SavedComparison) => {
    setSearchParams({ products: comparison.product_ids.join(",") });
    setSavedDialogOpen(false);
    toast({
      title: "تم التحميل",
      description: `تم تحميل "${comparison.name}"`,
    });
  };

  const handleDeleteSavedComparison = async (id: string) => {
    const { error } = await supabase.from("saved_comparisons").delete().eq("id", id);

    if (!error) {
      toast({
        title: "تم الحذف",
        description: "تم حذف المقارنة المحفوظة",
      });
      fetchSavedComparisons();
    }
  };

  const removeProduct = (productId: string) => {
    const currentIds = searchParams.get("products")?.split(",") || [];
    const newIds = currentIds.filter(id => id !== productId);
    
    if (newIds.length === 0) {
      navigate("/");
    } else {
      setSearchParams({ products: newIds.join(",") });
    }
  };

  const handleClearAll = () => {
    clearProducts();
    navigate("/");
    toast({
      title: "تم المسح",
      description: "تم مسح قائمة المقارنة بالكامل",
    });
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "تم النسخ",
        description: "تم نسخ رابط المقارنة إلى الحافظة",
      });
    } catch {
      toast({
        title: "خطأ",
        description: "فشل نسخ الرابط",
        variant: "destructive",
      });
    }
  };

  const getShareUrl = () => window.location.href;
  const getShareText = () => `مقارنة بين ${products.length} منتجات`;

  const handleShareWhatsApp = () => {
    const url = encodeURIComponent(getShareUrl());
    const text = encodeURIComponent(getShareText());
    window.open(`https://wa.me/?text=${text}%20${url}`, "_blank");
  };

  const handleShareTwitter = () => {
    const url = encodeURIComponent(getShareUrl());
    const text = encodeURIComponent(getShareText());
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const handleShareFacebook = () => {
    const url = encodeURIComponent(getShareUrl());
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
  };

  const addToCart = async (productId: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setAddingToCart(productId);
    try {
      const { error } = await supabase
        .from("cart_items")
        .upsert({
          user_id: user.id,
          product_id: productId,
          quantity: 1,
        });

      if (error) throw error;

      toast({
        title: "تمت الإضافة",
        description: "تم إضافة المنتج إلى السلة",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAddingToCart(null);
    }
  };

  const calculateDiscount = (original: number | null, current: number) => {
    if (!original) return null;
    return Math.round(((original - current) / original) * 100);
  };

  const getAverageRating = (reviews: { rating: number }[]) => {
    if (!reviews || reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  };

  const getLowestPrice = () => Math.min(...products.map(p => p.price));
  const getHighestRating = () => Math.max(...products.map(p => getAverageRating(p.reviews)));
  const getHighestStock = () => Math.max(...products.map(p => p.stock_quantity || 0));
  const getHighestDiscount = () => Math.max(...products.map(p => calculateDiscount(p.original_price, p.price) || 0));

  const comparisonRows: ComparisonRow[] = [
    {
      label: "السعر",
      icon: <DollarSign className="h-5 w-5" />,
      getValue: (product) => (
        <div className="text-center">
          <p className={`text-xl font-bold ${product.price === getLowestPrice() ? "text-green-600" : "text-foreground"}`}>
            {product.price} ل.س
          </p>
          {product.original_price && (
            <p className="text-sm text-muted-foreground line-through">
              {product.original_price} ل.س
            </p>
          )}
          {product.price === getLowestPrice() && products.length > 1 && (
            <Badge className="mt-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              <TrendingDown className="h-3 w-3 ml-1" />
              الأقل سعراً
            </Badge>
          )}
        </div>
      ),
      highlight: "lowest",
    },
    {
      label: "الخصم",
      icon: <Tag className="h-5 w-5" />,
      getValue: (product) => {
        const discount = calculateDiscount(product.original_price, product.price);
        const isHighest = discount === getHighestDiscount() && discount !== null && discount > 0;
        return (
          <div className="text-center">
            {discount ? (
              <>
                <Badge className={`${isHighest ? "bg-red-500" : "bg-muted text-muted-foreground"}`}>
                  {discount}% خصم
                </Badge>
                {isHighest && products.length > 1 && (
                  <p className="text-xs text-red-500 mt-1">أعلى خصم</p>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">لا يوجد</span>
            )}
          </div>
        );
      },
    },
    {
      label: "التقييم",
      icon: <Star className="h-5 w-5" />,
      getValue: (product) => {
        const rating = getAverageRating(product.reviews);
        const isHighest = rating === getHighestRating() && rating > 0;
        return (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.round(rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <p className="text-sm mt-1">
              {rating.toFixed(1)} ({product.reviews?.length || 0} تقييم)
            </p>
            {isHighest && products.length > 1 && (
              <Badge className="mt-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                الأعلى تقييماً
              </Badge>
            )}
          </div>
        );
      },
      highlight: "highest",
    },
    {
      label: "الفئة",
      icon: <Tag className="h-5 w-5" />,
      getValue: (product) => (
        <p className="text-center">{product.categories?.name_ar || "غير محدد"}</p>
      ),
    },
    {
      label: "الفئة الفرعية",
      icon: <Tag className="h-5 w-5" />,
      getValue: (product) => (
        <p className="text-center">{product.subcategories?.name_ar || "غير محدد"}</p>
      ),
    },
    {
      label: "البائع",
      icon: <User className="h-5 w-5" />,
      getValue: (product) => (
        <p className="text-center">{product.vendor?.full_name || "غير محدد"}</p>
      ),
    },
    {
      label: "المخزون",
      icon: <Package className="h-5 w-5" />,
      getValue: (product) => {
        const stock = product.stock_quantity || 0;
        const isHighest = stock === getHighestStock() && stock > 0;
        return (
          <div className="text-center">
            <p className={`font-medium ${stock === 0 ? "text-red-500" : stock < 5 ? "text-orange-500" : "text-green-600"}`}>
              {stock === 0 ? "نفد المخزون" : `${stock} قطعة`}
            </p>
            {isHighest && products.length > 1 && stock > 0 && (
              <Badge className="mt-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                الأعلى توفراً
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      label: "التوفر",
      icon: <Check className="h-5 w-5" />,
      getValue: (product) => (
        <div className="flex justify-center">
          {(product.stock_quantity || 0) > 0 ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              <Check className="h-3 w-3 ml-1" />
              متوفر
            </Badge>
          ) : (
            <Badge variant="destructive">
              <X className="h-3 w-3 ml-1" />
              غير متوفر
            </Badge>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
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

  if (products.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Scale className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-2xl font-bold">لا توجد منتجات للمقارنة</h2>
            <p className="text-muted-foreground">أضف منتجات من صفحات المنتجات لمقارنتها</p>
            <Button onClick={() => navigate("/")}>العودة للرئيسية</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Scale className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">مقارنة المنتجات</h1>
              <p className="text-muted-foreground">
                قارن بين {products.length} منتجات جنباً إلى جنب
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Save Comparison Button */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Bookmark className="h-4 w-4 ml-2" />
                  حفظ المقارنة
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>حفظ المقارنة</DialogTitle>
                  <DialogDescription>
                    أدخل اسماً للمقارنة لحفظها والرجوع إليها لاحقاً
                  </DialogDescription>
                </DialogHeader>
                <Input
                  placeholder="اسم المقارنة (اختياري)"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button onClick={handleSaveComparison} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Load Saved Comparisons Button */}
            <Dialog open={savedDialogOpen} onOpenChange={setSavedDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FolderOpen className="h-4 w-4 ml-2" />
                  المقارنات المحفوظة
                  {savedComparisons.length > 0 && (
                    <Badge className="mr-2" variant="secondary">
                      {savedComparisons.length}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>المقارنات المحفوظة</DialogTitle>
                  <DialogDescription>
                    اختر مقارنة لتحميلها
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {savedComparisons.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      لا توجد مقارنات محفوظة
                    </p>
                  ) : (
                    savedComparisons.map((comparison) => (
                      <div
                        key={comparison.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => handleLoadComparison(comparison)}
                        >
                          <p className="font-medium">{comparison.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {comparison.product_ids.length} منتجات •{" "}
                            {new Date(comparison.created_at).toLocaleDateString("ar")}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteSavedComparison(comparison.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 ml-2" />
                  )}
                  تصدير
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleExportAsImage} className="cursor-pointer">
                  <Image className="h-4 w-4 ml-2" />
                  تصدير كصورة (PNG)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportAsPDF} className="cursor-pointer">
                  <FileText className="h-4 w-4 ml-2" />
                  تصدير كـ PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Share2 className="h-4 w-4 ml-2" />
                  مشاركة المقارنة
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
                  <Copy className="h-4 w-4 ml-2" />
                  نسخ الرابط
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareWhatsApp} className="cursor-pointer">
                  <svg className="h-4 w-4 ml-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  واتساب
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareTwitter} className="cursor-pointer">
                  <svg className="h-4 w-4 ml-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  تويتر
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareFacebook} className="cursor-pointer">
                  <svg className="h-4 w-4 ml-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  فيسبوك
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 ml-2" />
                  مسح الكل
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم مسح جميع المنتجات من قائمة المقارنة. لا يمكن التراجع عن هذا الإجراء.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    نعم، مسح الكل
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-max" ref={comparisonRef}>
            {/* Product Images and Names Header */}
            <div 
              className="grid gap-4 mb-6" 
              style={{ gridTemplateColumns: `200px repeat(${products.length}, minmax(250px, 1fr))` }}
            >
              <div></div>
              {products.map((product) => (
                <Card key={product.id} className="relative overflow-hidden">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 left-2 z-10 bg-background/80 hover:bg-background"
                    onClick={() => removeProduct(product.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  
                  <div className="relative aspect-square overflow-hidden">
                    {product.original_price && (
                      <Badge className="absolute top-2 right-2 z-10 bg-red-500">
                        خصم {calculateDiscount(product.original_price, product.price)}%
                      </Badge>
                    )}
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => navigate(`/product/${product.id}`)}
                    />
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <h3 
                      className="font-bold text-lg line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      {product.name}
                    </h3>
                    
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1"
                        size="sm"
                        onClick={() => addToCart(product.id)}
                        disabled={addingToCart === product.id || (product.stock_quantity || 0) === 0}
                      >
                        {addingToCart === product.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ShoppingCart className="h-4 w-4 ml-1" />
                            أضف للسلة
                          </>
                        )}
                      </Button>
                      <FavoriteButton productId={product.id} variant="outline" size="sm" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Comparison Table */}
            <Card>
              <CardContent className="p-0">
                {comparisonRows.map((row, index) => (
                  <div key={row.label}>
                    <div 
                      className={`grid gap-4 p-4 items-center ${index % 2 === 0 ? "bg-muted/30" : ""}`}
                      style={{ gridTemplateColumns: `200px repeat(${products.length}, minmax(250px, 1fr))` }}
                    >
                      <div className="flex items-center gap-2 font-medium text-muted-foreground">
                        {row.icon}
                        <span>{row.label}</span>
                      </div>
                      {products.map((product) => (
                        <div key={product.id}>
                          {row.getValue(product)}
                        </div>
                      ))}
                    </div>
                    {index < comparisonRows.length - 1 && <Separator />}
                  </div>
                ))}

                {/* Description Row */}
                <Separator />
                <div 
                  className="grid gap-4 p-4"
                  style={{ gridTemplateColumns: `200px repeat(${products.length}, minmax(250px, 1fr))` }}
                >
                  <div className="flex items-start gap-2 font-medium text-muted-foreground pt-1">
                    <Minus className="h-5 w-5" />
                    <span>الوصف</span>
                  </div>
                  {products.map((product) => (
                    <p key={product.id} className="text-sm text-muted-foreground line-clamp-4">
                      {product.description || "لا يوجد وصف"}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Compare;

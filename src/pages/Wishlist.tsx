import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Gift, Plus, Share2, Copy, Trash2, Edit2, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Wishlist {
  id: string;
  name: string;
  share_token: string;
  is_public: boolean;
  created_at: string;
  items?: WishlistItem[];
}

interface WishlistItem {
  id: string;
  product_id: string;
  product?: {
    id: string;
    name: string;
    price: number;
    original_price: number | null;
    image_url: string;
  };
}

const Wishlist = () => {
  const { user, loading: authLoading } = useAuth();
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const fetchWishlists = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("wishlists")
      .select(`
        *,
        items:wishlist_items (
          id,
          product_id,
          product:products (
            id,
            name,
            price,
            original_price,
            image_url
          )
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setWishlists(data.map(w => ({
        ...w,
        items: w.items?.map((item: any) => ({
          ...item,
          product: item.product
        }))
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWishlists();
  }, [user]);

  const createWishlist = async () => {
    if (!user || !newListName.trim()) return;

    const { error } = await supabase
      .from("wishlists")
      .insert({
        user_id: user.id,
        name: newListName.trim()
      });

    if (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إنشاء القائمة",
        variant: "destructive"
      });
    } else {
      toast({
        title: "تم الإنشاء",
        description: "تم إنشاء قائمة الأمنيات بنجاح"
      });
      setNewListName("");
      setDialogOpen(false);
      fetchWishlists();
    }
  };

  const deleteWishlist = async (id: string) => {
    const { error } = await supabase
      .from("wishlists")
      .delete()
      .eq("id", id);

    if (!error) {
      toast({
        title: "تم الحذف",
        description: "تم حذف القائمة بنجاح"
      });
      fetchWishlists();
    }
  };

  const togglePublic = async (id: string, isPublic: boolean) => {
    const { error } = await supabase
      .from("wishlists")
      .update({ is_public: isPublic })
      .eq("id", id);

    if (!error) {
      toast({
        title: isPublic ? "تم التفعيل" : "تم الإلغاء",
        description: isPublic ? "يمكن للآخرين الآن مشاهدة قائمتك" : "القائمة خاصة الآن"
      });
      fetchWishlists();
    }
  };

  const updateName = async (id: string) => {
    if (!editName.trim()) return;

    const { error } = await supabase
      .from("wishlists")
      .update({ name: editName.trim() })
      .eq("id", id);

    if (!error) {
      setEditingId(null);
      fetchWishlists();
    }
  };

  const copyShareLink = (shareToken: string) => {
    const link = `${window.location.origin}/wishlist/shared/${shareToken}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "تم النسخ",
      description: "تم نسخ رابط المشاركة"
    });
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("id", itemId);

    if (!error) {
      fetchWishlists();
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Gift className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">قوائم الأمنيات</h1>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 ml-2" />
                إنشاء قائمة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إنشاء قائمة أمنيات جديدة</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="اسم القائمة"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                />
                <Button onClick={createWishlist} className="w-full">
                  إنشاء
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {wishlists.length === 0 ? (
          <div className="text-center py-12">
            <Gift className="h-24 w-24 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">لا توجد قوائم أمنيات</h2>
            <p className="text-muted-foreground mb-6">
              أنشئ قائمة أمنيات وشاركها مع أصدقائك
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {wishlists.map((wishlist) => (
              <Card key={wishlist.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div className="flex items-center gap-3">
                    {editingId === wishlist.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-48"
                        />
                        <Button size="icon" variant="ghost" onClick={() => updateName(wishlist.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <CardTitle>{wishlist.name}</CardTitle>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(wishlist.id);
                            setEditName(wishlist.name);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`public-${wishlist.id}`}
                        checked={wishlist.is_public}
                        onCheckedChange={(checked) => togglePublic(wishlist.id, checked)}
                      />
                      <Label htmlFor={`public-${wishlist.id}`}>عام</Label>
                    </div>
                    
                    {wishlist.is_public && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyShareLink(wishlist.share_token)}
                      >
                        <Copy className="h-4 w-4 ml-2" />
                        نسخ الرابط
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/wishlist/shared/${wishlist.share_token}`)}
                    >
                      <Share2 className="h-4 w-4 ml-2" />
                      معاينة
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deleteWishlist(wishlist.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {wishlist.items && wishlist.items.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {wishlist.items.map((item) => (
                        item.product && (
                          <div key={item.id} className="relative group">
                            <ProductCard
                              id={item.product.id}
                              name={item.product.name}
                              price={item.product.price}
                              originalPrice={item.product.original_price || undefined}
                              image={item.product.image_url}
                              rating={4}
                              reviews={0}
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      لا توجد منتجات في هذه القائمة
                    </p>
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

export default Wishlist;

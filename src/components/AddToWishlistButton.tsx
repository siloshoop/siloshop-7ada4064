import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Gift, Plus, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface AddToWishlistButtonProps {
  productId: string;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default" | "lg" | "icon";
}

interface Wishlist {
  id: string;
  name: string;
  hasProduct: boolean;
}

const AddToWishlistButton = ({ 
  productId, 
  variant = "outline", 
  size = "default" 
}: AddToWishlistButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  const fetchWishlists = async () => {
    if (!user) return;

    const { data: wishlistsData } = await supabase
      .from("wishlists")
      .select("id, name")
      .eq("user_id", user.id);

    if (wishlistsData) {
      const { data: itemsData } = await supabase
        .from("wishlist_items")
        .select("wishlist_id")
        .eq("product_id", productId)
        .in("wishlist_id", wishlistsData.map(w => w.id));

      const productWishlists = new Set(itemsData?.map(i => i.wishlist_id) || []);

      setWishlists(wishlistsData.map(w => ({
        ...w,
        hasProduct: productWishlists.has(w.id)
      })));
    }
  };

  useEffect(() => {
    fetchWishlists();
  }, [user, productId]);

  const toggleProductInWishlist = async (wishlistId: string, hasProduct: boolean) => {
    setLoading(true);

    if (hasProduct) {
      const { error } = await supabase
        .from("wishlist_items")
        .delete()
        .eq("wishlist_id", wishlistId)
        .eq("product_id", productId);
      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "تمت الإزالة", description: "تم إزالة المنتج من القائمة" });
      }
    } else {
      const { error } = await supabase
        .from("wishlist_items")
        .insert({
          wishlist_id: wishlistId,
          product_id: productId
        });
      if (error) {
        if ((error as any).code === "23505") {
          toast({ title: "موجود مسبقاً", description: "هذا المنتج موجود في هذه القائمة بالفعل" });
        } else {
          toast({ title: "خطأ", description: error.message, variant: "destructive" });
        }
      } else {
        toast({ title: "تمت الإضافة", description: "تم إضافة المنتج إلى القائمة" });
      }
    }

    await fetchWishlists();
    setLoading(false);
  };

  const createAndAdd = async () => {
    if (!user || !newListName.trim()) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("wishlists")
      .insert({
        user_id: user.id,
        name: newListName.trim()
      })
      .select()
      .single();

    if (error || !data) {
      toast({ title: "خطأ", description: error?.message || "تعذّر إنشاء القائمة", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { error: itemErr } = await supabase
        .from("wishlist_items")
        .insert({
          wishlist_id: data.id,
          product_id: productId
        });

    if (itemErr) {
      toast({ title: "خطأ", description: itemErr.message, variant: "destructive" });
    } else {
      toast({ title: "تم", description: "تم إنشاء القائمة وإضافة المنتج" });
      setNewListName("");
      setDialogOpen(false);
      await fetchWishlists();
    }

    setLoading(false);
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} disabled={loading}>
            <Gift className="h-4 w-4 ml-2" />
            أضف لقائمة الأمنيات
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {wishlists.map((wishlist) => (
            <DropdownMenuItem
              key={wishlist.id}
              onClick={() => toggleProductInWishlist(wishlist.id, wishlist.hasProduct)}
              className="flex items-center justify-between"
            >
              <span>{wishlist.name}</span>
              {wishlist.hasProduct && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 ml-2" />
            قائمة جديدة
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
            <Button onClick={createAndAdd} className="w-full" disabled={loading}>
              إنشاء وإضافة المنتج
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddToWishlistButton;

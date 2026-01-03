import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Loader2, Gift, Lock } from "lucide-react";

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

interface Wishlist {
  id: string;
  name: string;
  is_public: boolean;
  items?: WishlistItem[];
}

const SharedWishlist = () => {
  const { token } = useParams<{ token: string }>();
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchWishlist = async () => {
      if (!token) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("wishlists")
        .select(`
          id,
          name,
          is_public,
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
        .eq("share_token", token)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setWishlist({
          ...data,
          items: data.items?.map((item: any) => ({
            ...item,
            product: item.product
          }))
        });
      }
      setLoading(false);
    };

    fetchWishlist();
  }, [token]);

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

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Gift className="h-24 w-24 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">القائمة غير موجودة</h2>
            <p className="text-muted-foreground">
              قد تكون القائمة محذوفة أو الرابط غير صحيح
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (wishlist && !wishlist.is_public) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Lock className="h-24 w-24 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">قائمة خاصة</h2>
            <p className="text-muted-foreground">
              هذه القائمة خاصة ولا يمكن مشاهدتها
            </p>
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
        <div className="mb-8 text-center">
          <Gift className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">{wishlist?.name}</h1>
          <p className="text-muted-foreground">
            قائمة أمنيات مشاركة • {wishlist?.items?.length || 0} منتج
          </p>
        </div>

        {wishlist?.items && wishlist.items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlist.items.map((item) => (
              item.product && (
                <ProductCard
                  key={item.id}
                  id={item.product.id}
                  name={item.product.name}
                  price={item.product.price}
                  originalPrice={item.product.original_price || undefined}
                  image={item.product.image_url}
                  rating={4}
                  reviews={0}
                />
              )
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">لا توجد منتجات في هذه القائمة</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default SharedWishlist;

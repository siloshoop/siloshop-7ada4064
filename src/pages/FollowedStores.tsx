import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store as StoreIcon, Users, Package, Star, ArrowLeft, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FollowedStore {
  id: string;
  vendor_id: string;
  store_name: string;
  logo_url: string | null;
  rating: number;
  product_count: number;
  follower_count: number;
}

const FollowedStores = () => {
  const [stores, setStores] = useState<FollowedStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      try {
        const { data: rows, error } = await supabase
          .from("vendor_followers")
          .select("id, vendor_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;

        const resolved = await Promise.all(
          (rows || []).map(async (row) => {
            const { data } = await supabase.rpc("get_store_public_profile", {
              _vendor_id: row.vendor_id,
            });
            const p: any = Array.isArray(data) ? data[0] : data;
            return {
              id: row.id,
              vendor_id: row.vendor_id,
              store_name: p?.store_name || "متجر",
              logo_url: p?.logo_url ?? null,
              rating: Number(p?.rating || 0),
              product_count: Number(p?.product_count || 0),
              follower_count: Number(p?.follower_count || 0),
            } as FollowedStore;
          })
        );
        setStores(resolved);
      } catch {
        toast({ title: "تعذر تحميل المتاجر المتابَعة", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate, toast]);

  const unfollow = async (row: FollowedStore) => {
    setBusyId(row.id);
    try {
      const { error } = await supabase.from("vendor_followers").delete().eq("id", row.id);
      if (error) throw error;
      setStores((prev) => prev.filter((s) => s.id !== row.id));
      toast({ title: "تم إلغاء متابعة المتجر", description: row.store_name });
    } catch {
      toast({ title: "تعذر إلغاء المتابعة", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <StoreIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">المتاجر التي أتابعها</h1>
              <p className="text-sm text-muted-foreground">
                {loading ? "جارٍ التحميل..." : `${stores.length} متجر`}
              </p>
            </div>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            رجوع
          </Button>
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        )}

        {!loading && stores.length === 0 && (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-muted p-4">
                <StoreIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="mb-2 text-lg font-semibold">لا تتابع أي متجر بعد</h3>
                <p className="text-muted-foreground">
                  تابع متاجرك المفضلة لتصل إلى منتجاتها الجديدة بسرعة.
                </p>
              </div>
              <Button onClick={() => navigate("/")}>تصفح المتاجر</Button>
            </div>
          </Card>
        )}

        {!loading && stores.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <Card key={store.id} className="overflow-hidden transition-shadow hover:shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => navigate(`/store/${store.vendor_id}`)}
                      className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted"
                    >
                      {store.logo_url ? (
                        <img
                          src={store.logo_url}
                          alt={store.store_name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <StoreIcon className="h-6 w-6 text-primary" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => navigate(`/store/${store.vendor_id}`)}
                        className="block max-w-full truncate font-semibold hover:text-primary"
                      >
                        {store.store_name}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Package className="h-3 w-3" />
                          {store.product_count} منتج
                        </Badge>
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Users className="h-3 w-3" />
                          {store.follower_count}
                        </Badge>
                        {store.rating > 0 && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Star className="h-3 w-3 fill-amber-400 text-warning" />
                            {store.rating.toFixed(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/store/${store.vendor_id}`)}>
                      زيارة المتجر
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => unfollow(store)}
                      disabled={busyId === store.id}
                    >
                      {busyId === store.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "إلغاء المتابعة"}
                    </Button>
                  </div>
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

export default FollowedStores;

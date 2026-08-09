import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Package, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SectionHeader from "@/components/home/SectionHeader";

interface FeaturedStore {
  id: string;
  name: string;
  avatar: string | null;
  productCount: number;
  covers: string[];
}

const FeaturedStores = () => {
  const [stores, setStores] = useState<FeaturedStore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await supabase
          .from("products")
          .select("vendor_id, image_url")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(200);

        const grouped = new Map<string, string[]>();
        for (const row of data ?? []) {
          if (!row.vendor_id) continue;
          const images = grouped.get(row.vendor_id) ?? [];
          if (row.image_url) images.push(row.image_url);
          grouped.set(row.vendor_id, images);
        }

        const top = [...grouped.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 6);

        const resolved = await Promise.all(
          top.map(async ([vendorId, images]) => {
            const { data: info } = await supabase.rpc("get_vendor_public_info", {
              vendor_id: vendorId,
            });
            const vendor = Array.isArray(info) ? info[0] : null;
            if (!vendor) return null;
            return {
              id: vendorId,
              name: vendor.full_name || "متجر",
              avatar: vendor.avatar_url ?? null,
              productCount: images.length,
              covers: images.slice(0, 3),
            } satisfies FeaturedStore;
          }),
        );

        if (!cancelled) {
          setStores(resolved.filter((store): store is FeaturedStore => store !== null));
        }
      } catch (error) {
        console.error("FeaturedStores error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && stores.length === 0) return null;

  return (
    <section className="py-7">
      <div className="container px-4">
        <SectionHeader
          icon={Store}
          eyebrow="متاجر مميزة"
          title="متاجر يثق بها المشترون"
          subtitle="أكثر المتاجر نشاطاً على سيلو شوب"
          tone="accent"
        />

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store, i) => (
              <Link
                key={store.id}
                to={`/store/${store.id}`}
                className="group animate-fade-in overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-elegant)] motion-reduce:transition-none"
                style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}
              >
                <div className="grid grid-cols-3 gap-0.5 bg-muted">
                  {(store.covers.length > 0 ? store.covers : [null, null, null]).map((cover, index) => (
                    <div key={index} className="aspect-square overflow-hidden bg-muted">
                      {cover ? (
                        <img
                          src={cover}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-primary/15 to-accent/15" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 p-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background">
                    {store.avatar ? (
                      <img src={store.avatar} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5 text-primary" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{store.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Package className="h-3.5 w-3.5" />
                      {store.productCount} منتج
                    </p>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedStores;

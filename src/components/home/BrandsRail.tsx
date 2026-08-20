import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Tags } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SectionHeader from "@/components/home/SectionHeader";

interface Brand {
  id: string;
  name_ar: string;
  logo_url: string | null;
}

const BrandsRail = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await supabase
          .from("brands")
          .select("id, name_ar, logo_url")
          .eq("is_active", true)
          .order("name_ar", { ascending: true });
        if (!cancelled) setBrands(data ?? []);
      } catch (error) {
        console.error("BrandsRail error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && brands.length === 0) return null;
  if (loading) return null;

  return (
    <section className="py-7">
      <div className="container px-4">
        <SectionHeader icon={Tags} eyebrow="العلامات التجارية" title="تسوق حسب البراند" />

        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              to={`/search?brand=${brand.id}`}
              className="flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card p-3 text-center shadow-[var(--shadow-card)] transition-colors hover:border-primary/40"
            >
              {brand.logo_url ? (
                <img
                  src={brand.logo_url}
                  alt={brand.name_ar}
                  className="h-12 w-12 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {brand.name_ar.charAt(0)}
                </div>
              )}
              <span className="line-clamp-1 text-xs font-semibold">{brand.name_ar}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrandsRail;

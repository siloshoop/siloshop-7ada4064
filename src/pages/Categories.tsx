import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Tag } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Cat { id: string; name_ar: string; image_url: string | null; sort_order: number }
interface Sub {
  id: string;
  category_id: string;
  parent_subcategory_id: string | null;
  name_ar: string;
  image_url: string | null;
  sort_order: number;
}

/** Trendyol-style category browser: main tabs → side groups → leaf grid. */
const Categories = () => {
  const [params, setParams] = useSearchParams();
  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: s }] = await Promise.all([
        supabase.from("categories").select("id,name_ar,image_url,sort_order").eq("is_active", true).is("parent_id", null).order("sort_order"),
        supabase.from("subcategories").select("id,category_id,parent_subcategory_id,name_ar,image_url,sort_order").eq("is_active", true).order("sort_order"),
      ]);
      setCats((c as Cat[]) || []);
      setSubs((s as Sub[]) || []);
      setLoading(false);
    })();
  }, []);

  const activeCat = params.get("c") || cats[0]?.id;
  const groups = useMemo(
    () => subs.filter((s) => s.category_id === activeCat && !s.parent_subcategory_id),
    [subs, activeCat],
  );
  const activeGroup = params.get("g") && groups.some((g) => g.id === params.get("g")) ? params.get("g")! : groups[0]?.id;
  const leaves = subs.filter((s) => s.parent_subcategory_id === activeGroup);

  const pick = (c: string, g?: string) => {
    const next = new URLSearchParams();
    next.set("c", c);
    if (g) next.set("g", g);
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pb-20 md:pb-8">
        <h1 className="sr-only">تصفّح الفئات</h1>

        {/* Main category tabs */}
        <div className="sticky top-0 z-20 border-b bg-background">
          <div className="flex gap-2 overflow-x-auto px-3 py-3 scrollbar-hide">
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => pick(c.id)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  c.id === activeCat ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50",
                )}
              >
                {c.name_ar}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">جاري التحميل…</div>
        ) : (
          <div className="container flex gap-3 px-2 pt-3 md:px-4">
            {/* Side group list */}
            <nav aria-label="الأقسام" className="w-28 shrink-0 space-y-1.5 sm:w-40 md:w-56">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => pick(activeCat!, g.id)}
                  className={cn(
                    "block w-full rounded-md border-s-4 px-2 py-3 text-start text-xs font-semibold leading-snug sm:text-sm",
                    g.id === activeGroup ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-muted text-foreground hover:bg-muted/70",
                  )}
                >
                  {g.name_ar}
                </button>
              ))}
            </nav>

            {/* Leaf grid */}
            <section className="min-w-0 flex-1">
              {activeGroup && (
                <Link
                  to={`/subcategory/${activeCat}/${activeGroup}`}
                  className="mb-3 block text-sm font-semibold text-primary hover:underline"
                >
                  عرض كل منتجات {groups.find((g) => g.id === activeGroup)?.name_ar} ←
                </Link>
              )}
              <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
                {leaves.map((l) => (
                  <Link key={l.id} to={`/subcategory/${activeCat}/${l.id}`} className="group flex flex-col items-center text-center">
                    <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border bg-card transition-shadow group-hover:shadow-md">
                      {l.image_url ? (
                        <img src={l.image_url} alt={l.name_ar} loading="lazy" className="h-full w-full object-contain p-2" />
                      ) : (
                        <Tag className="h-8 w-8 text-muted-foreground" aria-hidden />
                      )}
                    </div>
                    <span className="mt-1.5 line-clamp-2 text-xs leading-tight">{l.name_ar}</span>
                  </Link>
                ))}
              </div>
              {leaves.length === 0 && activeGroup && (
                <p className="text-sm text-muted-foreground">لا توجد أقسام فرعية هنا بعد — افتح «عرض كل المنتجات».</p>
              )}
            </section>
          </div>
        )}
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
};

export default Categories;

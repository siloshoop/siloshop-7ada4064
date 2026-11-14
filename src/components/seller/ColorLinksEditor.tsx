import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search } from "lucide-react";
import { resizedImageUrl } from "@/lib/imageUrl";
import { colorAlternativeLabel, type ColorAlternative } from "@/lib/productColorLinks";

interface Props {
  /** Product being edited (excluded from the list); undefined while adding. */
  productId?: string;
  /** Platform products link only to platform products, seller products only to the seller's own. */
  platform?: boolean;
  value: string[];
  onChange: (ids: string[]) => void;
}

/** Picks other products of the same owner that are the same item in another color. */
const ColorLinksEditor = ({ productId, platform = false, value, onChange }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<ColorAlternative[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    let q = supabase
      .from("products")
      .select("id, name, image_url, colors, stock_quantity")
      .neq("moderation_status", "archived")
      .order("created_at", { ascending: false })
      .limit(300);
    q = platform ? q.eq("product_type", "platform") : q.eq("product_type", "seller").eq("vendor_id", user.id);
    q.then(({ data }) => {
      if (cancelled) return;
      setItems(((data as ColorAlternative[] | null) ?? []).filter((p) => p.id !== productId));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user, platform, productId]);

  const shown = useMemo(() => {
    const t = query.trim().toLowerCase();
    const list = t ? items.filter((p) => p.name.toLowerCase().includes(t) || (p.colors ?? []).some((c) => c.toLowerCase().includes(t))) : items;
    return [...list].sort((a, b) => Number(value.includes(b.id)) - Number(value.includes(a.id)));
  }, [items, query, value]);

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id].slice(0, 20));

  return (
    <div className="space-y-2">
      <Label>ربط ألوان أخرى لنفس المنتج (اختياري)</Label>
      <p className="text-xs text-muted-foreground">
        اختر منتجاتك التي هي نفس هذا المنتج بلون آخر. تظهر صورها للمشتري كألوان، وعند الضغط عليها ينتقل إلى صفحتها بصورها وسعرها ومقاساتها وكميتها.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم المنتج أو اللون" className="pr-9" aria-label="البحث عن منتج لربطه" />
      </div>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : shown.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">لا توجد منتجات أخرى لربطها.</p>
      ) : (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1">
          {shown.map((p) => {
            const checked = value.includes(p.id);
            return (
              <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm ${checked ? "bg-primary/5" : ""}`}>
                <Checkbox checked={checked} onCheckedChange={() => toggle(p.id)} aria-label={`ربط ${p.name}`} />
                {p.image_url ? (
                  <img src={resizedImageUrl(p.image_url, 96)} alt="" className="h-12 w-10 shrink-0 rounded object-cover" loading="lazy" />
                ) : (
                  <span className="h-12 w-10 shrink-0 rounded bg-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{colorAlternativeLabel(p)}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}
      {value.length > 0 && <p className="text-xs text-muted-foreground">تم اختيار {value.length} منتج.</p>}
    </div>
  );
};

export default ColorLinksEditor;

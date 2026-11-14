import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resizedImageUrl } from "@/lib/imageUrl";
import { colorAlternativeLabel, type ColorAlternative } from "@/lib/productColorLinks";

interface Props {
  productId: string;
  groupId: string;
}

/** Trendyol-style color thumbnails: each linked product is the same item in another color. */
const ProductColorAlternatives = ({ productId, groupId }: Props) => {
  const [items, setItems] = useState<ColorAlternative[]>([]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("products")
      .select("id, name, image_url, colors, stock_quantity")
      .eq("color_group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(21)
      .then(({ data }) => {
        if (!cancelled) setItems((data as ColorAlternative[] | null) ?? []);
      });
    return () => { cancelled = true; };
  }, [groupId]);

  if (items.length < 2) return null;
  const current = items.find((p) => p.id === productId);

  return (
    <div className="min-w-0 space-y-2.5">
      <p className="text-sm text-foreground">
        <span className="font-bold">اللون:</span>{" "}
        <span className="text-muted-foreground">{current ? colorAlternativeLabel(current) : ""}</span>
      </p>
      <div className="flex flex-wrap gap-2.5">
        {items.map((p) => {
          const active = p.id === productId;
          const label = colorAlternativeLabel(p);
          return (
            <Link
              key={p.id}
              to={`/product/${p.id}`}
              aria-current={active ? "true" : undefined}
              aria-label={label}
              title={label}
              className={`block h-[4.5rem] w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active ? "border-selected" : "border-border hover:border-selected/50"
              }`}
            >
              {p.image_url ? (
                <img src={resizedImageUrl(p.image_url, 160)} alt={label} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-muted text-xs font-bold text-muted-foreground">{Array.from(label)[0]}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default ProductColorAlternatives;

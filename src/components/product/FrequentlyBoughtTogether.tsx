import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Item {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  stock_quantity: number | null;
}

interface Props {
  product: Item;
  categoryId: string | null;
  vendorId: string;
}

/**
 * "Frequently bought together" bundle: the current product plus up to two
 * companion products from the same category (falls back to the same seller).
 */
const FrequentlyBoughtTogether = ({ product, categoryId, vendorId }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [companions, setCompanions] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = () =>
        supabase
          .from("products")
          .select("id, name, price, image_url, stock_quantity")
          .eq("is_active", true)
          .gt("stock_quantity", 0)
          .neq("id", product.id)
          .limit(2);

      let rows: Item[] = [];
      if (categoryId) {
        const { data } = await base().eq("category_id", categoryId);
        rows = (data ?? []) as Item[];
      }
      if (rows.length === 0) {
        const { data } = await base().eq("vendor_id", vendorId);
        rows = (data ?? []) as Item[];
      }
      if (cancelled) return;
      setCompanions(rows);
      setSelected(Object.fromEntries(rows.map((r) => [r.id, true])));
    })();
    return () => {
      cancelled = true;
    };
  }, [product.id, categoryId, vendorId]);

  if (companions.length === 0) return null;

  const chosen = companions.filter((c) => selected[c.id]);
  const total = product.price + chosen.reduce((s, c) => s + c.price, 0);

  const addBundle = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setAdding(true);
    try {
      for (const item of [product, ...chosen]) {
        const { data: existing } = await supabase
          .from("cart_items")
          .select("id, quantity")
          .eq("user_id", user.id)
          .eq("product_id", item.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("cart_items")
            .update({ quantity: existing.quantity + 1 })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("cart_items")
            .insert({ user_id: user.id, product_id: item.id, quantity: 1 });
        }
      }
      toast({
        title: "تمت الإضافة",
        description: `تم إضافة ${chosen.length + 1} منتجات إلى السلة`,
      });
    } catch {
      toast({ title: "خطأ", description: "فشل في إضافة المنتجات للسلة", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const Thumb = ({ item }: { item: Item }) => (
    <img
      src={item.image_url || "/placeholder.svg"}
      alt={item.name}
      loading="lazy"
      className="h-20 w-20 rounded-xl border object-cover"
    />
  );

  return (
    <section className="mt-12">
      <h2 className="mb-4 text-xl font-bold md:text-2xl">يُشترى عادة معاً</h2>
      <div className="rounded-2xl border bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Thumb item={product} />
          {companions.map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <button onClick={() => navigate(`/product/${c.id}`)} aria-label={c.name}>
                <Thumb item={c} />
              </button>
            </div>
          ))}
        </div>

        <ul className="mt-4 space-y-2">
          <li className="flex items-start gap-2 text-sm">
            <Checkbox checked disabled className="mt-0.5" />
            <span className="flex-1">
              <span className="font-medium">هذا المنتج: </span>
              {product.name}
            </span>
            <span className="font-semibold text-primary">
              {product.price.toLocaleString()} ل.س
            </span>
          </li>
          {companions.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={!!selected[c.id]}
                onCheckedChange={(v) => setSelected((s) => ({ ...s, [c.id]: v === true }))}
                aria-label={`تحديد ${c.name}`}
              />
              <span className="flex-1 line-clamp-2">{c.name}</span>
              <span className="font-semibold text-primary">{c.price.toLocaleString()} ل.س</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div>
            <p className="text-xs text-muted-foreground">
              إجمالي {chosen.length + 1} منتجات
            </p>
            <p className="text-xl font-bold text-primary">{total.toLocaleString()} ل.س</p>
          </div>
          <Button className="rounded-full" onClick={addBundle} disabled={adding}>
            {adding ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="ml-2 h-4 w-4" />
            )}
            أضف الكل إلى السلة
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FrequentlyBoughtTogether;

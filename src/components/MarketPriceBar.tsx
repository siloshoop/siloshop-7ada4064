import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface Props {
  productId: string;
  price: number;
  categoryId: string | null;
}

const MarketPriceBar = ({ productId, price, categoryId }: Props) => {
  const [avg, setAvg] = useState<number | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!categoryId) return;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("price")
        .eq("is_active", true)
        .eq("category_id", categoryId)
        .neq("id", productId)
        .limit(200);
      if (data && data.length > 0) {
        const sum = data.reduce((s: number, r: any) => s + Number(r.price || 0), 0);
        setAvg(sum / data.length);
        setCount(data.length);
      }
    })();
  }, [productId, categoryId]);

  if (!avg || count === 0) return null;

  const diff = price - avg;
  const pct = avg > 0 ? (diff / avg) * 100 : 0;
  const isLower = diff < 0;
  const isEqual = Math.abs(pct) < 1;
  const Icon = isEqual ? Minus : isLower ? TrendingDown : TrendingUp;
  const tone = isEqual
    ? "text-muted-foreground"
    : isLower
    ? "text-success dark:text-success"
    : "text-warning dark:text-warning";
  const label = isEqual
    ? "مماثل لمتوسط السوق"
    : isLower
    ? `أقل بـ ${Math.abs(pct).toFixed(0)}% من متوسط السوق`
    : `أعلى بـ ${Math.abs(pct).toFixed(0)}% من متوسط السوق`;

  const ratio = Math.min(100, Math.max(0, (price / (avg * 2)) * 100));

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 text-sm font-semibold ${tone}`}>
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <span className="text-xs text-muted-foreground">
          متوسط: {Math.round(avg).toLocaleString()} ل.س
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/40" />
        <div
          className={`absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-background ${
            isLower ? "bg-success" : isEqual ? "bg-muted-foreground" : "bg-warning"
          }`}
          style={{ left: `calc(${ratio}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>أرخص</span>
        <span>المتوسط</span>
        <span>أغلى</span>
      </div>
    </Card>
  );
};

export default MarketPriceBar;
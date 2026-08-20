import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  MousePointerClick,
  Boxes,
  ShoppingCart,
  DollarSign,
  ClipboardList,
  Heart,
  ShoppingBag,
  Undo2,
  Star,
  Percent,
  AlertTriangle,
} from "lucide-react";

interface ProductAnalyticsDialogProps {
  productId: string | null;
  productName?: string;
  onOpenChange: (open: boolean) => void;
}

interface AnalyticsData {
  views?: number;
  clicks?: number;
  stock?: number;
  units_sold?: number;
  revenue?: number;
  orders?: number;
  wishlist_count?: number;
  cart_count?: number;
  returns?: number;
  review_count?: number;
  review_score?: number;
  conversion_rate?: number;
}

const ProductAnalyticsDialog = ({ productId, productName, onOpenChange }: ProductAnalyticsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    if (!productId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    (supabase.rpc as any)("product_analytics", { _product_id: productId }).then(
      ({ data: res, error: err }: { data: unknown; error: { message: string } | null }) => {
        if (!active) return;
        if (err) {
          setError(err.message);
        } else {
          setData((res as AnalyticsData) ?? {});
        }
        setLoading(false);
      }
    );
    return () => {
      active = false;
    };
  }, [productId]);

  const fmtNum = (v: number | undefined) => Number(v ?? 0).toLocaleString("ar-SY");
  const fmtMoney = (v: number | undefined) => `${Number(v ?? 0).toLocaleString("ar-SY")} ل.س`;
  const fmtPct = (v: number | undefined) => `${Number(v ?? 0).toLocaleString("ar-SY", { maximumFractionDigits: 2 })}%`;

  const kpis = data
    ? [
        { label: "المشاهدات", value: fmtNum(data.views), icon: Eye },
        { label: "النقرات", value: fmtNum(data.clicks), icon: MousePointerClick },
        { label: "المخزون الحالي", value: fmtNum(data.stock), icon: Boxes },
        { label: "الوحدات المباعة", value: fmtNum(data.units_sold), icon: ShoppingCart },
        { label: "الإيرادات", value: fmtMoney(data.revenue), icon: DollarSign },
        { label: "عدد الطلبات", value: fmtNum(data.orders), icon: ClipboardList },
        { label: "قائمة الأمنيات", value: fmtNum(data.wishlist_count), icon: Heart },
        { label: "في سلة الشراء", value: fmtNum(data.cart_count), icon: ShoppingBag },
        { label: "المرتجعات", value: fmtNum(data.returns), icon: Undo2 },
        { label: "عدد التقييمات", value: fmtNum(data.review_count), icon: ClipboardList },
        { label: "متوسط التقييم", value: Number(data.review_score ?? 0).toFixed(1), icon: Star },
        { label: "معدل التحويل", value: fmtPct(data.conversion_rate), icon: Percent },
      ]
    : [];

  return (
    <Dialog open={!!productId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>إحصائيات المنتج{productName ? `: ${productName}` : ""}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-destructive">
            <AlertTriangle className="h-8 w-8" />
            <p>تعذّر تحميل الإحصائيات.</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {kpis.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center gap-1 rounded-lg border bg-card p-3 text-center">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-lg font-bold">{value}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProductAnalyticsDialog;

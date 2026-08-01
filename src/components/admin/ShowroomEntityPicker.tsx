import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Store, Package, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickedVendor {
  vendor_id: string;
  name: string;
  logo_url: string | null;
  rating: number | null;
  product_count: number;
}

export interface PickedProduct {
  product_id: string;
  name: string;
  price: number;
  discount_price: number | null;
  image_url: string | null;
  sku: string | null;
  vendor_id: string;
  vendor_name: string;
  rating: number | null;
}

const useDebounced = (value: string, delay = 350) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

const formatPrice = (n: number) => `${Number(n).toLocaleString("ar-SY")} ل.س`;

/** Real Supabase-backed searchable selector for vendors/stores (Super Admin only RPC). */
export const VendorPicker = ({
  selectedId,
  selectedLabel,
  onSelect,
  onClear,
}: {
  selectedId: string;
  selectedLabel?: string;
  onSelect: (vendor: PickedVendor) => void;
  onClear: () => void;
}) => {
  const [term, setTerm] = useState("");
  const debounced = useDebounced(term);
  const [results, setResults] = useState<PickedVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    supabase
      .rpc("admin_search_showroom_vendors", { _search: debounced, _limit: 20 })
      .then(({ data, error: err }) => {
        if (id !== reqId.current) return;
        if (err) setError(err.message);
        setResults((data as PickedVendor[]) || []);
        setLoading(false);
      });
  }, [debounced]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ابحث عن متجر بالاسم…"
          className="ps-9"
        />
      </div>
      {selectedId && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2 text-sm">
          <Check className="h-4 w-4 text-primary" />
          <span className="flex-1 font-medium">{selectedLabel || selectedId}</span>
          <Button type="button" variant="ghost" size="icon" onClick={onClear} aria-label="إلغاء الاختيار">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : results.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">لا توجد متاجر مطابقة</p>
        ) : (
          results.map((v) => (
            <button
              key={v.vendor_id}
              type="button"
              onClick={() => onSelect(v)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md p-2 text-start transition-colors hover:bg-muted",
                selectedId === v.vendor_id && "bg-primary/10"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {v.logo_url ? (
                  <img src={v.logo_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <Store className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{v.name}</p>
                <p className="text-xs text-muted-foreground">
                  {v.product_count} منتج{v.rating != null ? ` · تقييم ${v.rating}` : ""}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

/** Real Supabase-backed searchable selector for products (Super Admin only RPC). */
export const ProductPicker = ({
  selectedId,
  selectedLabel,
  vendorFilter,
  onSelect,
  onClear,
}: {
  selectedId: string;
  selectedLabel?: string;
  vendorFilter?: string | null;
  onSelect: (product: PickedProduct) => void;
  onClear: () => void;
}) => {
  const [term, setTerm] = useState("");
  const debounced = useDebounced(term);
  const [results, setResults] = useState<PickedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    supabase
      .rpc("admin_search_showroom_products", {
        _search: debounced,
        _vendor_id: vendorFilter || null,
        _limit: 20,
      })
      .then(({ data, error: err }) => {
        if (id !== reqId.current) return;
        if (err) setError(err.message);
        setResults((data as PickedProduct[]) || []);
        setLoading(false);
      });
  }, [debounced, vendorFilter]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ابحث عن منتج بالاسم أو رمز SKU…"
          className="ps-9"
        />
      </div>
      {selectedId && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2 text-sm">
          <Check className="h-4 w-4 text-primary" />
          <span className="flex-1 font-medium">{selectedLabel || selectedId}</span>
          <Button type="button" variant="ghost" size="icon" onClick={onClear} aria-label="إلغاء الاختيار">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : results.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">لا توجد منتجات مطابقة</p>
        ) : (
          results.map((p) => (
            <button
              key={p.product_id}
              type="button"
              onClick={() => onSelect(p)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md p-2 text-start transition-colors hover:bg-muted",
                selectedId === p.product_id && "bg-primary/10"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {p.image_url ? (
                  <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatPrice(p.discount_price ?? p.price)} · {p.vendor_name}
                  {p.sku ? ` · ${p.sku}` : ""}
                </p>
              </div>
              {p.rating != null && <Badge variant="secondary">{p.rating}</Badge>}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
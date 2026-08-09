import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { matchesSearchTerm, normalizeSearchTerm } from "@/lib/search";

export interface ProductSuggestion {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category_id: string | null;
  brand_id: string | null;
}

export interface TaxonomyItem {
  id: string;
  name: string;
}

interface Taxonomies {
  categories: TaxonomyItem[];
  brands: TaxonomyItem[];
}

/** Module-level caches so the dropdown is instant after the first open. */
let taxonomyCache: Taxonomies | null = null;
let taxonomyPromise: Promise<Taxonomies> | null = null;
let popularCache: string[] | null = null;
let popularPromise: Promise<string[]> | null = null;
const productCache = new Map<string, ProductSuggestion[]>();

const loadTaxonomies = (): Promise<Taxonomies> => {
  if (taxonomyCache) return Promise.resolve(taxonomyCache);
  if (!taxonomyPromise) {
    taxonomyPromise = (async () => {
      const [cats, brands] = await Promise.all([
        supabase.from("categories").select("id, name_ar").order("name_ar"),
        supabase.from("brands").select("id, name_ar").eq("is_active", true).order("name_ar"),
      ]);
      const result: Taxonomies = {
        categories: (cats.data ?? []).map((c) => ({ id: c.id, name: c.name_ar })),
        brands: (brands.data ?? []).map((b) => ({ id: b.id, name: b.name_ar })),
      };
      taxonomyCache = result;
      return result;
    })().catch(() => {
      taxonomyPromise = null;
      return { categories: [], brands: [] };
    });
  }
  return taxonomyPromise;
};

/** Popular searches = most ordered product names (real activity, cached per session). */
const loadPopular = (): Promise<string[]> => {
  if (popularCache) return Promise.resolve(popularCache);
  if (!popularPromise) {
    popularPromise = (async () => {
      const { data } = await supabase
        .from("order_items")
        .select("product_id, quantity, products(name)")
        .order("created_at", { ascending: false })
        .limit(300);

      const counts = new Map<string, number>();
      (data ?? []).forEach((row: any) => {
        const name: string | undefined = row.products?.name;
        if (!name) return;
        counts.set(name, (counts.get(name) ?? 0) + (row.quantity ?? 1));
      });

      let names = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);

      if (names.length < 6) {
        // Fall back to newest active products so the panel is never empty.
        const { data: newest } = await supabase
          .from("products")
          .select("name")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(8);
        const extra = (newest ?? []).map((p) => p.name).filter((n) => !names.includes(n));
        names = [...names, ...extra];
      }

      popularCache = names.slice(0, 8);
      return popularCache;
    })().catch(() => {
      popularPromise = null;
      return [];
    });
  }
  return popularPromise;
};

/**
 * Live search suggestions: debounced product lookup (server-side ilike) plus
 * instant category/brand matches from cached taxonomies.
 */
export const useSearchSuggestions = (query: string, debounceMs = 220) => {
  const [taxonomies, setTaxonomies] = useState<Taxonomies>(() => taxonomyCache ?? { categories: [], brands: [] });
  const [popular, setPopular] = useState<string[]>(() => popularCache ?? []);
  const [products, setProducts] = useState<ProductSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    let active = true;
    void loadTaxonomies().then((t) => active && setTaxonomies(t));
    void loadPopular().then((p) => active && setPopular(p));
    return () => {
      active = false;
    };
  }, []);

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const key = normalizeSearchTerm(term);
    const cached = productCache.get(key);
    if (cached) {
      setProducts(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, image_url, category_id, brand_id")
        .eq("is_active", true)
        .ilike("name", `%${term}%`)
        .limit(8);

      // Ignore out-of-order responses.
      if (id !== requestId.current) return;
      const rows = (data ?? []) as ProductSuggestion[];
      productCache.set(key, rows);
      setProducts(rows);
      setLoading(false);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [term, debounceMs]);

  const categoryMatches = useMemo(
    () => (term ? taxonomies.categories.filter((c) => matchesSearchTerm(c.name, term)).slice(0, 4) : []),
    [taxonomies.categories, term],
  );

  const brandMatches = useMemo(
    () => (term ? taxonomies.brands.filter((b) => matchesSearchTerm(b.name, term)).slice(0, 4) : []),
    [taxonomies.brands, term],
  );

  /** Smart completions built from product names that start with the term. */
  const smartSuggestions = useMemo(() => {
    if (!term) return [];
    const seen = new Set<string>();
    return products
      .map((p) => p.name)
      .filter((name) => {
        const key = normalizeSearchTerm(name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  }, [products, term]);

  const prefetch = useCallback(() => {
    void loadTaxonomies();
    void loadPopular();
  }, []);

  return {
    products,
    categories: categoryMatches,
    brands: brandMatches,
    smartSuggestions,
    popular,
    loading,
    prefetch,
  };
};
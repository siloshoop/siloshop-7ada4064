import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Flame, Gem, Layers, Loader2, Search as SearchIcon, TrendingUp, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { supabase } from "@/integrations/supabase/client";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from "@/lib/searchHistory";
import { cn } from "@/lib/utils";

interface SearchAutocompleteProps {
  className?: string;
  placeholder?: string;
  /** Called after a suggestion is picked (e.g. to close a mobile sheet). */
  onNavigate?: () => void;
  autoFocus?: boolean;
}

const SearchAutocomplete = ({
  className,
  placeholder = "ابحث عن المنتجات، الفئات، العلامات...",
  onNavigate,
  autoFocus,
}: SearchAutocompleteProps) => {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [popularTerms, setPopularTerms] = useState<{ term: string; hits: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { products, categories, brands, smartSuggestions, loading, prefetch } =
    useSearchSuggestions(value);

  useEffect(() => {
    let active = true;
    const sync = () => {
      void getRecentSearches().then((terms) => {
        if (active) setRecent(terms);
      });
    };
    sync();
    window.addEventListener("recent-searches-updated", sync);
    return () => {
      active = false;
      window.removeEventListener("recent-searches-updated", sync);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.rpc("popular_search_terms", { _limit: 8 }).then(({ data }) => {
      if (active && data) setPopularTerms(data);
    });
    return () => {
      active = false;
    };
  }, []);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (path: string, term?: string) => {
    if (term) addRecentSearch(term);
    setOpen(false);
    inputRef.current?.blur();
    navigate(path);
    onNavigate?.();
  };

  const submitTerm = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setValue(clean);
    go(`/search?q=${encodeURIComponent(clean)}`, clean);
  };

  const hasQuery = value.trim().length >= 2;
  const showResults =
    hasQuery && (products.length > 0 || categories.length > 0 || brands.length > 0 || loading);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form
        className="relative"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submitTerm(value);
        }}
      >
        <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            prefetch();
            setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full pr-10"
          enterKeyHint="search"
          aria-label="البحث في الموقع"
          aria-expanded={open}
          autoComplete="off"
        />
        {loading && hasQuery && (
          <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
        )}
      </form>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border bg-popover p-2 shadow-xl animate-fade-in">
          {/* Live product results */}
          {showResults && (
            <section className="mb-1">
              <p className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">نتائج مباشرة</p>
              {products.length === 0 && !loading ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">لا توجد منتجات مطابقة</p>
              ) : (
                products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => go(`/product/${p.id}`, value)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-right transition-colors hover:bg-accent"
                  >
                    <img
                      src={p.image_url || "/placeholder.svg"}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      className="h-10 w-10 shrink-0 rounded-md object-cover"
                    />
                    <span className="flex-1 truncate text-sm">{p.name}</span>
                    <span className="shrink-0 text-xs font-semibold text-primary">
                      {p.price.toLocaleString()} ل.س
                    </span>
                  </button>
                ))
              )}
            </section>
          )}

          {/* Smart suggestions (completions) */}
          {hasQuery && smartSuggestions.length > 0 && (
            <section className="mb-1 border-t pt-1">
              <p className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">اقتراحات ذكية</p>
              <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                {smartSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submitTerm(s)}
                    className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                  >
                    <TrendingUp className="ml-1 inline h-3 w-3" />
                    {s}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Category matches */}
          {categories.length > 0 && (
            <section className="mb-1 border-t pt-1">
              <p className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">في الفئات</p>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => go(`/category/${c.id}`, value)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-sm transition-colors hover:bg-accent"
                >
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  {c.name}
                </button>
              ))}
            </section>
          )}

          {/* Brand matches */}
          {brands.length > 0 && (
            <section className="mb-1 border-t pt-1">
              <p className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">
                في العلامات التجارية
              </p>
              {brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => go(`/search?brand=${b.id}`, value)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-sm transition-colors hover:bg-accent"
                >
                  <Gem className="h-4 w-4 text-muted-foreground" />
                  {b.name}
                </button>
              ))}
            </section>
          )}

          {/* Recent searches */}
          {!hasQuery && recent.length > 0 && (
            <section className="mb-1">
              <div className="flex items-center justify-between px-2 py-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground">آخر عمليات البحث</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => {
                    void clearRecentSearches();
                    setRecent([]);
                  }}

                >
                  حذف الكل
                </Button>
              </div>
              {recent.map((term) => (
                <div key={term} className="flex items-center gap-1 rounded-lg hover:bg-accent">
                  <button
                    type="button"
                    onClick={() => submitTerm(term)}
                    className="flex flex-1 items-center gap-2 px-2 py-2 text-right text-sm"
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{term}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`حذف ${term}`}
                    onClick={() => void removeRecentSearch(term).then(setRecent)}
                    className="p-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </section>
          )}

          {/* Popular searches */}
          {!hasQuery && popularTerms.length > 0 && (
            <section className="border-t pt-1">
              <p className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">الأكثر بحثاً</p>
              <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                {popularTerms.map(({ term, hits }) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => submitTerm(term)}
                    className="rounded-full bg-secondary px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                    title={`${hits} عملية بحث`}
                  >
                    <Flame className="ml-1 inline h-3 w-3 text-accent-foreground" />
                    {term}
                  </button>
                ))}
              </div>
            </section>
          )}

          {!hasQuery && recent.length === 0 && popularTerms.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              اكتب كلمة للبحث عن المنتجات والفئات والعلامات التجارية
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchAutocomplete;
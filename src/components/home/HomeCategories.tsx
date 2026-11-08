import { Link } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { categoryAppearance } from "@/lib/categoryAppearance";
import SectionHeader from "@/components/home/SectionHeader";

const MAX_CATEGORIES = 12;

/** Homepage category cards — shares the cached public category list with the menus. */
const HomeCategories = () => {
  const { data: categories = [], isLoading, isError } = useCategories();
  if (isError || (!isLoading && categories.length === 0)) return null;

  const shown = categories.slice(0, MAX_CATEGORIES);

  return (
    <section className="py-5" aria-label="تسوّق حسب الفئة">
      <div className="container px-4">
        <SectionHeader icon={LayoutGrid} eyebrow="الفئات" title="تسوّق حسب الفئة" href="/categories" />
        <ul className="grid grid-cols-5 gap-1.5 min-[380px]:grid-cols-6 sm:grid-cols-8 sm:gap-2 lg:grid-cols-12">
          {isLoading
            ? Array.from({ length: 12 }, (_, i) => (
                <li key={i} aria-hidden className="h-[80px] animate-pulse rounded-xl border border-border/60 bg-muted sm:h-[92px] sm:rounded-2xl" />
              ))
            : shown.map((category) => {
                const { Icon, tone, emoji } = categoryAppearance(category);
                return (
                  <li key={category.id} className="min-w-0">
                    <Link
                      to={`/categories?c=${category.id}`}
                      className="gradient-edge-hover group relative flex h-full flex-col items-center gap-1 overflow-hidden rounded-xl border border-border/60 bg-card px-0.5 pb-1.5 pt-2.5 text-center shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elegant motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:gap-1.5 sm:rounded-2xl sm:px-1 sm:pb-2 sm:pt-3"
                    >
                      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-ad" />
                      <span aria-hidden className="rounded-full bg-gradient-ad p-[1.5px] shadow-sm">
                        <span className={`category-tone-${tone} relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full sm:h-10 sm:w-10`}>
                          {emoji ? <span className="text-base sm:text-lg">{emoji}</span> : <Icon className="h-4 w-4 sm:h-5 sm:w-5" />}
                          {category.image_url && (
                            <img
                              src={category.image_url}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-cover"
                              onError={(event) => { event.currentTarget.hidden = true; }}
                            />
                          )}
                        </span>
                      </span>
                      <span className="line-clamp-2 w-full text-[10px] font-semibold min-[380px]:text-[10.5px] leading-[1.15] tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-xs sm:leading-tight">
                        {category.name_ar}
                      </span>
                    </Link>
                  </li>
                );
              })}
        </ul>
      </div>
    </section>
  );
};

export default HomeCategories;

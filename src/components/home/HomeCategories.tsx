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
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3">
          {isLoading
            ? Array.from({ length: 8 }, (_, i) => (
                <li key={i} aria-hidden className="h-[104px] animate-pulse rounded-2xl border border-border/60 bg-muted sm:h-[124px]" />
              ))
            : shown.map((category) => {
                const { Icon, tone, emoji } = categoryAppearance(category);
                return (
                  <li key={category.id} className="min-w-0">
                    <Link
                      to={`/categories?c=${category.id}`}
                      className="gradient-edge-hover group relative flex h-full flex-col items-center gap-2 overflow-hidden rounded-2xl border border-border/60 bg-card px-1.5 pb-2.5 pt-3.5 text-center shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elegant motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:pt-4"
                    >
                      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-ad" />
                      <span aria-hidden className="rounded-full bg-gradient-ad p-[2px] shadow-sm">
                        <span className={`category-tone-${tone} relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full sm:h-14 sm:w-14`}>
                          {emoji ? <span className="text-xl">{emoji}</span> : <Icon className="h-5 w-5 sm:h-6 sm:w-6" />}
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
                      <span className="line-clamp-2 w-full break-words text-[11px] font-semibold leading-tight transition-colors group-hover:text-primary sm:text-sm">
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

import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { categoryAppearance } from "@/lib/categoryAppearance";

const CategoryDrawerList = ({ onNavigate }: { onNavigate: () => void }) => {
  const { data: categories = [] } = useCategories();
  return (
    <ul className="space-y-1">
      {categories.map((category) => {
        const { Icon, tone, emoji } = categoryAppearance(category);
        return (
          <li key={category.id}>
            <Link to={`/categories?c=${category.id}`} onClick={onNavigate} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted">
              <span className={`category-tone-${tone} flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full`}>
                {category.image_url ? <img src={category.image_url} alt="" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.hidden = true; }} /> : emoji ? <span>{emoji}</span> : <Icon className="h-5 w-5" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug">{category.name_ar}</span>
              <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
};
export default CategoryDrawerList;

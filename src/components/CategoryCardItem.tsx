import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useCategoryCardPress } from "@/hooks/useCategoryCardPress";

interface CategoryColors {
  bg: string;
  icon: string;
  ring: string;
}

interface CategoryLike {
  id: string;
  name_ar: string;
  product_count?: number;
}

interface Props {
  category: CategoryLike;
  colors: CategoryColors;
  isExpanded: boolean;
  hasSubs: boolean;
  index: number;
  IconComponent: React.ComponentType<{ className?: string }>;
  onActivate: () => void;
}

/**
 * One category card.
 * - Custom press logic: shows tap effect once and auto-clears (no stuck/jitter on mobile)
 * - Full keyboard support (Enter / Space) with high-contrast focus-visible ring
 * - Hover effects only on devices that truly support hover (motion-safe + @media hover)
 */
export const CategoryCardItem = ({
  category,
  colors,
  isExpanded,
  hasSubs,
  index,
  IconComponent,
  onActivate,
}: Props) => {
  const { pressed, handlers } = useCategoryCardPress(180);

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`فئة ${category.name_ar}، ${category.product_count ?? 0} منتج`}
      aria-expanded={hasSubs ? isExpanded : undefined}
      data-pressed={pressed ? "true" : undefined}
      className={`category-card group cursor-pointer transition-transform transition-shadow duration-150 ease-out motion-safe:hover:scale-[1.05] motion-safe:hover:-translate-y-1 hover:shadow-xl border border-border/50 bg-gradient-to-br ${colors.bg} backdrop-blur-sm overflow-hidden ring-2 ${
        isExpanded ? "ring-primary/60 motion-safe:scale-[1.03] shadow-xl" : `ring-transparent ${colors.ring}`
      } ${pressed ? "scale-[0.96] shadow-inner" : ""}`}
      style={{ animationDelay: `${index * 30}ms` }}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      {...handlers}
    >
      <CardContent className="p-3 sm:p-4 flex flex-col items-center gap-2 text-center relative">
        <div className="category-card-icon p-2.5 rounded-xl bg-background/80 backdrop-blur-sm shadow-sm group-hover:shadow-md transition-transform transition-shadow duration-150 motion-safe:group-hover:scale-110">
          <IconComponent className={`h-6 w-6 ${colors.icon} transition-transform duration-150`} />
        </div>
        <div className="min-w-0 w-full">
          <h3 className="text-sm font-semibold text-foreground line-clamp-1">{category.name_ar}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{category.product_count ?? 0} منتج</p>
        </div>
        {hasSubs && (
          <ChevronDown
            className={`absolute top-2 left-2 h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 ${
              isExpanded ? "rotate-180 text-primary" : ""
            }`}
          />
        )}
      </CardContent>
    </Card>
  );
};
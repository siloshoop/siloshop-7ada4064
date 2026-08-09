import { Skeleton } from "@/components/ui/skeleton";

export const ProductCardSkeleton = () => (
  <div className="overflow-hidden rounded-xl border bg-card">
    <Skeleton className="aspect-square w-full rounded-none" />
    <div className="space-y-2 p-3">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  </div>
);

/** Horizontal rail placeholder that matches ProductRail card widths. */
export const ProductRailSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="-mx-4 flex gap-3 overflow-hidden px-4 pb-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="w-[46%] shrink-0 sm:w-[31%] lg:w-[23%] xl:w-[19%]">
        <ProductCardSkeleton />
      </div>
    ))}
  </div>
);

/** Responsive grid placeholder for search / category / store listings. */
export const ProductGridSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </div>
);

export default ProductCardSkeleton;
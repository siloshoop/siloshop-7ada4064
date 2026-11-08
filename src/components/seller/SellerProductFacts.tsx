import { useState } from "react";
import { Ruler } from "lucide-react";
import { formatDimensions, parseFeatures } from "@/lib/productFeatures";

const PREVIEW_COUNT = 3;

/** Compact size + features summary for one row of the seller's product list. */
const SellerProductFacts = ({
  features,
  length,
  width,
  height,
}: {
  features: unknown;
  length: number | string | null | undefined;
  width: number | string | null | undefined;
  height?: number | string | null;
}) => {
  const [expanded, setExpanded] = useState(false);
  const dims = formatDimensions(length, width, height);
  const items = parseFeatures(features);

  if (!dims && items.length === 0) {
    return <p className="mt-1 text-xs text-muted-foreground">لا يوجد مقاس أو ميزات محفوظة</p>;
  }

  const visible = expanded ? items : items.slice(0, PREVIEW_COUNT);
  const hidden = items.length - visible.length;

  return (
    <div className="mt-1.5 space-y-1.5">
      {dims && (
        <p className="flex items-center gap-1 text-xs text-foreground">
          <Ruler className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">{dims.label}:</span>
          <span dir="auto" className="font-semibold">{dims.value}</span>
        </p>
      )}
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="ميزات المنتج">
          {visible.map((f, i) => (
            <li
              key={`${f.title}-${i}`}
              className="max-w-full truncate rounded-full bg-muted/60 px-2 py-0.5 text-[11px] sm:max-w-[16rem]"
              title={`${f.title}: ${f.value}`}
            >
              <span dir="auto" className="text-muted-foreground">{f.title}:</span>{" "}
              <span dir="auto" className="font-semibold text-foreground">{f.value}</span>
            </li>
          ))}
          {(hidden > 0 || expanded) && items.length > PREVIEW_COUNT && (
            <li>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-primary hover:underline"
                aria-expanded={expanded}
              >
                {expanded ? "عرض أقل" : `+${hidden} ميزات أخرى`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SellerProductFacts;

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import {
  MAX_FEATURES,
  MAX_FEATURE_TITLE,
  MAX_FEATURE_VALUE,
  newFeatureRow,
  type FeatureRow,
} from "@/lib/productFeatures";

interface Props {
  value: FeatureRow[];
  onChange: (rows: FeatureRow[]) => void;
}

/** Free-form list of product features (title + value) that sellers add, edit and remove. */
const ProductFeaturesEditor = ({ value, onChange }: Props) => {
  const update = (id: string, patch: Partial<FeatureRow>) =>
    onChange(value.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => onChange(value.filter((r) => r.id !== id));
  const add = () => {
    if (value.length >= MAX_FEATURES) return;
    onChange([...value, newFeatureRow()]);
  };

  return (
    <div className="space-y-3" data-testid="product-features-editor">
      <p className="text-xs text-muted-foreground">
        أضف ميزات المنتج بالعربية أو الإنجليزية، مثل: الخامة: قطن · بلد المنشأ: تركيا · محتويات العلبة: قطعتان.
      </p>

      {value.length === 0 && (
        <p className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
          لا توجد ميزات بعد.
        </p>
      )}

      {value.map((row, i) => (
        <div key={row.id} className="flex items-start gap-2 rounded-xl border bg-muted/20 p-2">
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <Label htmlFor={`feature-title-${row.id}`} className="text-xs text-muted-foreground">
                عنوان الميزة {i + 1}
              </Label>
              <Input
                id={`feature-title-${row.id}`}
                dir="auto"
                value={row.title}
                maxLength={MAX_FEATURE_TITLE}
                placeholder="مثال: الخامة"
                onChange={(e) => update(row.id, { title: e.target.value })}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label htmlFor={`feature-value-${row.id}`} className="text-xs text-muted-foreground">
                القيمة
              </Label>
              <Input
                id={`feature-value-${row.id}`}
                dir="auto"
                value={row.value}
                maxLength={MAX_FEATURE_VALUE}
                placeholder="مثال: قطن"
                onChange={(e) => update(row.id, { value: e.target.value })}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-5 shrink-0 text-destructive hover:text-destructive"
            onClick={() => remove(row.id)}
            aria-label={`حذف الميزة ${i + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={add}
        disabled={value.length >= MAX_FEATURES}
        className="w-full sm:w-auto"
      >
        <Plus className="me-2 h-4 w-4" />
        إضافة ميزة
      </Button>
      {value.length >= MAX_FEATURES && (
        <p className="text-xs text-muted-foreground">وصلت إلى الحد الأقصى ({MAX_FEATURES} ميزة).</p>
      )}
    </div>
  );
};

export default ProductFeaturesEditor;

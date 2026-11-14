import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useImageCropper } from "@/components/ImageCropDialog";
import { UploadError, validateImageFile } from "@/lib/uploadErrors";
import { uploadProductImage } from "@/lib/productImageUpload";

interface Props {
  colors: string[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

/** One optional picture per color; buyers see it on the color button and in the gallery when they pick the color. */
const ColorImagesEditor = ({ colors, value, onChange }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { crop, dialog } = useImageCropper("product");
  const [busy, setBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);

  if (colors.length === 0) return null;

  const pick = (color: string) => {
    target.current = color;
    inputRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const color = target.current;
    if (!file || !color || !user) return;
    const invalid = validateImageFile(file, "product");
    if (invalid) {
      toast({ title: "تعذّر إضافة الصورة", description: invalid, variant: "destructive" });
      return;
    }
    const cropped = await crop(file);
    if (!cropped) return;
    setBusy(color);
    try {
      const url = await uploadProductImage(user.id, cropped, "colors");
      onChange({ ...value, [color]: url });
    } catch (err) {
      toast({
        title: "تعذّر رفع صورة اللون",
        description: err instanceof UploadError ? err.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const remove = (color: string) => {
    const { [color]: _removed, ...rest } = value;
    onChange(rest);
  };

  return (
    <div className="space-y-2">
      <Label>صورة لكل لون (اختياري)</Label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {colors.map((color) => {
          const image = value[color];
          return (
            <div key={color} className="flex min-w-0 items-center gap-2 rounded-lg border p-2">
              <button
                type="button"
                onClick={() => pick(color)}
                disabled={busy === color}
                aria-label={image ? `تغيير صورة اللون ${color}` : `رفع صورة اللون ${color}`}
                className="flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/40 text-muted-foreground"
              >
                {busy === color ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : image ? (
                  <img src={image} alt={color} className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{color}</p>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => pick(color)} disabled={busy === color}>
                    {image ? "تغيير" : "رفع صورة"}
                  </Button>
                  {image && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label={`حذف صورة اللون ${color}`} onClick={() => remove(color)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        تظهر صورة اللون للمشتري على زر اللون وفي معرض الصور عند اختياره، وتُحفظ مع الطلب.
      </p>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" aria-hidden="true" tabIndex={-1} onChange={onFile} />
      {dialog}
    </div>
  );
};

export default ColorImagesEditor;

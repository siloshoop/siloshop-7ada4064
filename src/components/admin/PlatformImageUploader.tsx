import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Star, StarOff, Loader2, GripVertical } from "lucide-react";
import imageCompression from "browser-image-compression";

interface Props {
  images: string[];
  mainImage: string | null;
  onChange: (images: string[], mainImage: string | null) => void;
}

const PlatformImageUploader = ({ images, mainImage, onChange }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setUploading(true);
      const uploaded: string[] = [];
      try {
        for (const file of files) {
          if (!file.type.startsWith("image/")) continue;
          const compressed = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
          });
          const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase();
          const path = `platform/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage
            .from("product-images")
            .upload(path, compressed, { cacheControl: "3600", upsert: false });
          if (error) throw error;
          const { data } = supabase.storage.from("product-images").getPublicUrl(path);
          uploaded.push(data.publicUrl);
        }
        const next = [...images, ...uploaded];
        onChange(next, mainImage || uploaded[0] || next[0] || null);
      } catch (e: any) {
        toast({ title: "خطأ في الرفع", description: e.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    },
    [images, mainImage, onChange, toast]
  );

  const remove = (url: string) => {
    const next = images.filter((i) => i !== url);
    const newMain = mainImage === url ? next[0] || null : mainImage;
    onChange(next, newMain);
  };

  const setMain = (url: string) => onChange(images, url);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next, mainImage);
  };

  return (
    <div className="space-y-3">
      <Label>صور المنتج</Label>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          uploadFiles(Array.from(e.dataTransfer.files));
        }}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"
        }`}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">اسحب الصور هنا أو انقر للاختيار</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => uploadFiles(Array.from(e.target.files || []))}
        />
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((url, idx) => (
            <div
              key={url}
              className={`relative group rounded-lg overflow-hidden border-2 ${
                mainImage === url ? "border-primary" : "border-transparent"
              }`}
            >
              <img src={url} alt="" className="w-full aspect-square object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  onClick={() => setMain(url)}
                  title="تعيين كصورة رئيسية"
                >
                  {mainImage === url ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                </Button>
                <Button type="button" size="icon" variant="secondary" onClick={() => move(idx, idx - 1)} title="أعلى">
                  <GripVertical className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="destructive" onClick={() => remove(url)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {mainImage === url && (
                <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                  رئيسية
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlatformImageUploader;
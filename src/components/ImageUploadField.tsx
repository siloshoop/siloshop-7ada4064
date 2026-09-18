import { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { ImageIcon, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ImageUploadFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  bucket: "product-images" | "profile-images" | "store-assets";
  folder: string;
  privateBucket?: boolean;
  disabled?: boolean;
  previewClassName?: string;
};

const isExternalUrl = (value: string) => /^(https?:|data:|blob:)/i.test(value);

const ImageUploadField = ({
  label,
  value,
  onChange,
  bucket,
  folder,
  privateBucket = false,
  disabled = false,
  previewClassName,
}: ImageUploadFieldProps) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadedPathRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const resolvePreview = async () => {
      setImageFailed(false);
      if (!value) {
        setPreview(null);
        return;
      }
      if (isExternalUrl(value) || !privateBucket) {
        setPreview(value);
        return;
      }
      const { data } = await supabase.storage.from(bucket).createSignedUrl(value, 3600);
      if (active) setPreview(data?.signedUrl ?? null);
    };
    void resolvePreview();
    return () => {
      active = false;
    };
  }, [bucket, privateBucket, value]);

  const removeTemporaryUpload = async () => {
    const path = uploadedPathRef.current;
    if (!path) return;
    uploadedPathRef.current = null;
    await supabase.storage.from(bucket).remove([path]);
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "الملف يجب أن يكون صورة", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "حجم الصورة كبير", description: "الحد الأقصى 5 ميجابايت", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
      const extension = (compressed.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${folder}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from(bucket).upload(path, compressed, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;

      await removeTemporaryUpload();
      uploadedPathRef.current = path;
      if (privateBucket) {
        onChange(path);
      } else {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        onChange(data.publicUrl);
      }
      toast({ title: "تم رفع الصورة" });
    } catch (error) {
      toast({
        title: "تعذّر رفع الصورة",
        description: error instanceof Error ? error.message : "يرجى المحاولة مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    await removeTemporaryUpload();
    onChange("");
    setPreview(null);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        dir="ltr"
        value={value}
        disabled={disabled || uploading}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://..."
        aria-label={`${label} عبر رابط`}
      />
      <div className="flex min-w-0 flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center">
        <div className={cn("flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted sm:w-36", previewClassName)}>
          {preview && !imageFailed ? (
            <img
              src={preview}
              alt={`معاينة ${label}`}
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <ImageIcon className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : value ? <Pencil className="me-2 h-4 w-4" /> : <Upload className="me-2 h-4 w-4" />}
            {value ? "استبدال الصورة" : "رفع من الجهاز"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" disabled={disabled || uploading} onClick={() => void remove()}>
              <Trash2 className="me-2 h-4 w-4 text-destructive" /> حذف الصورة
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(event) => void upload(event.target.files?.[0])}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageUploadField;
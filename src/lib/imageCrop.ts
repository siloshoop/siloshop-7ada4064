import type { ImageKind } from "@/lib/uploadErrors";

export interface CropPreset {
  label: string;
  width: number;
  height: number;
}

export const CROP_PRESETS: Record<ImageKind, CropPreset> = {
  logo: { label: "شعار المتجر", width: 500, height: 500 },
  cover: { label: "صورة الغلاف", width: 1920, height: 600 },
  product: { label: "صورة المنتج", width: 1000, height: 1000 },
};

export interface PixelArea { x: number; y: number; width: number; height: number }

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذّر قراءة الصورة؛ قد يكون الملف تالفًا."));
    img.src = src;
  });

/** Crops the area and scales it to the preset's exact output size. */
export const cropToFile = async (src: string, area: PixelArea, preset: CropPreset, name: string): Promise<File> => {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("المتصفح لا يدعم معالجة الصور.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, preset.width, preset.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
  if (!blob) throw new Error("تعذّر حفظ الصورة بعد القص.");
  const base = name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
};

export const fileToDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("تعذّر قراءة الصورة."));
    r.readAsDataURL(file);
  });

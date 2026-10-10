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

export const MAX_CROP_SIDE = 8000;
export type ImagePlacement = "fill" | "fit";
export const validateCropDimensions = (width: number, height: number): string | null =>
  !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_CROP_SIDE || height > MAX_CROP_SIDE
    ? "أدخل عرضًا وارتفاعًا صحيحين بين 1 و8000 بكسل." : null;

export const originalDimensions = (width: number, height: number) => {
  const scale = Math.min(1, MAX_CROP_SIDE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

export const fitRectangle = (sourceWidth: number, sourceHeight: number, width: number, height: number) => {
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const w = sourceWidth * scale, h = sourceHeight * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذّر قراءة الصورة؛ قد يكون الملف تالفًا."));
    img.src = src;
  });

/** Crops the area and scales it to the preset's exact output size. */
export const cropToFile = async (src: string, area: PixelArea, preset: CropPreset, name: string, options?: { placement?: ImagePlacement; original?: File; assessmentOnly?: boolean }): Promise<File> => {
  const invalid = validateCropDimensions(preset.width, preset.height);
  if (invalid) throw new Error(invalid);
  const img = await loadImage(src);
  const fit = options?.placement === "fit";
  if (!options?.assessmentOnly && options?.original && preset.width === img.naturalWidth && preset.height === img.naturalHeight &&
      (fit || (area.x === 0 && area.y === 0 && area.width === img.naturalWidth && area.height === img.naturalHeight))) {
    return options.original;
  }
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("المتصفح لا يدعم معالجة الصور.");
  const png = !options?.assessmentOnly && ["image/png", "image/gif"].includes(options?.original?.type ?? "");
  if (!png) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingQuality = "high";
  if (fit) {
    const rect = fitRectangle(img.naturalWidth, img.naturalHeight, preset.width, preset.height);
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
  } else {
    ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, preset.width, preset.height);
  }
  const mime = png ? "image/png" : options?.original?.type === "image/webp" && !options?.assessmentOnly ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, mime, options?.assessmentOnly ? 0.85 : 1));
  // Release the large backing buffer promptly on memory-constrained devices.
  canvas.width = 1; canvas.height = 1;
  if (!blob) throw new Error("تعذّر حفظ المقاس المختار على هذا الجهاز. اختر أبعادًا أصغر وأعد المحاولة.");
  const base = name.replace(/\.[^.]+$/, "") || "image";
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${base}.${ext}`, { type: blob.type });
};

export const fileToDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("تعذّر قراءة الصورة."));
    r.readAsDataURL(file);
  });

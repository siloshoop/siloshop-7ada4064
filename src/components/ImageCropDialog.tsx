import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Loader2, Sparkles, ZoomIn, Maximize, Scan, MoveDiagonal } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CROP_PRESETS, cropToFile, fileToDataUrl, originalDimensions, validateCropDimensions, MAX_CROP_SIDE, type ImagePlacement, type PixelArea } from "@/lib/imageCrop";
import { validateImageFile, type ImageKind } from "@/lib/uploadErrors";

const RATIOS = [{ value: "original", label: "النسبة الأصلية" }, { value: "1", label: "1:1" }, { value: "1.3333333333333333", label: "4:3" }, { value: "0.75", label: "3:4" }, { value: "1.7777777777777777", label: "16:9" }, { value: "free", label: "قص حر" }];

interface Assessment {
  score: number;
  verdict: "excellent" | "good" | "needs_improvement" | "unsuitable";
  clarity: "sharp" | "acceptable" | "blurry";
  lighting: "good" | "acceptable" | "poor";
  background: "clean" | "acceptable" | "cluttered";
  subject_visible: boolean;
  issues: string[];
  suggestions: string[];
  summary: string;
}

const VERDICT: Record<Assessment["verdict"], { label: string; variant: "default" | "secondary" | "destructive" }> = {
  excellent: { label: "ممتازة", variant: "default" },
  good: { label: "جيدة", variant: "default" },
  needs_improvement: { label: "تحتاج تحسين", variant: "secondary" },
  unsuitable: { label: "غير مناسبة", variant: "destructive" },
};
const LEVEL: Record<string, string> = {
  sharp: "حادة", acceptable: "مقبولة", blurry: "ضبابية", good: "جيدة", poor: "ضعيفة", clean: "نظيفة", cluttered: "مزدحمة",
};

interface Props {
  file: File | null;
  kind: ImageKind;
  onDone: (file: File | null) => void;
}

/** Crop + preview step with fixed presets; product photos can be checked by Lovable AI. */
const ImageCropDialog = ({ file, kind, onDone }: Props) => {
  const preset = CROP_PRESETS[kind];
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<PixelArea | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [assessError, setAssessError] = useState<string | null>(null);
  const assessReq = useRef(0);
  const product = kind === "product";
  const [dimensions, setDimensions] = useState({ width: preset.width, height: preset.height });
  const [natural, setNatural] = useState({ width: 1, height: 1 });
  const [ratio, setRatio] = useState("original");
  const [placement, setPlacement] = useState<ImagePlacement>("fill");
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ width: 300, height: 256 });
  const resizeStart = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const output = { ...preset, ...(product ? dimensions : {}) };
  const dimensionError = validateCropDimensions(output.width, output.height);
  const aspect = output.width > 0 && output.height > 0 ? output.width / output.height : 1;
  const frameScale = Math.min((frame.width - 32) / Math.max(aspect, 0.01), frame.height - 32);
  const cropSize = { width: Math.max(1, frameScale * aspect), height: Math.max(1, frameScale) };

  useEffect(() => {
    const el = frameRef.current;
    if (!el || !file) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setFrame({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [file]);

  useEffect(() => {
    if (!file) { setSrc(null); return; }
    const url = URL.createObjectURL(file);
    setSrc(url);
    let active = true;
    setCrop({ x: 0, y: 0 }); setZoom(1); setArea(null); setError(null); setAssessment(null); setAssessError(null);
    setRatio("original"); setPlacement("fill"); setDimensions({ width: preset.width, height: preset.height });
    ++assessReq.current; setAssessing(false);
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      setNatural({ width: image.naturalWidth, height: image.naturalHeight });
      if (product) setDimensions(originalDimensions(image.naturalWidth, image.naturalHeight));
    };
    image.onerror = () => { if (active) setError("تعذّر قراءة الصورة؛ جرّب ملفًا آخر."); };
    image.src = url;
    return () => { active = false; ++assessReq.current; URL.revokeObjectURL(url); };
  }, [file]);

  useEffect(() => { ++assessReq.current; setAssessment(null); setAssessing(false); setAssessError(null); }, [dimensions, placement, crop, zoom]);

  const changeDimension = (key: "width" | "height", value: number) => {
    const fixedRatio = ratio === "original" ? natural.width / natural.height : Number(ratio);
    setDimensions((previous) => ratio === "free" ? { ...previous, [key]: value } : key === "width"
      ? { width: value, height: Math.round(value / fixedRatio) }
      : { width: Math.round(value * fixedRatio), height: value });
    setArea(null);
  };

  const chooseRatio = (value: string) => {
    setRatio(value); setArea(null); setCrop({ x: 0, y: 0 }); setZoom(1);
    if (value === "original") setDimensions(originalDimensions(natural.width, natural.height));
    else if (value !== "free") {
      const r = Number(value);
      const width = Math.max(1, Math.min(dimensions.width, MAX_CROP_SIDE, Math.floor(MAX_CROP_SIDE * r)));
      setDimensions({ width, height: Math.max(1, Math.round(width / r)) });
    }
  };

  const onCropComplete = useCallback((_: unknown, px: PixelArea) => { setArea(px); setAssessment(null); }, []);

  const confirm = async () => {
    if (!src || !area || !file || dimensionError) return;
    setWorking(true); setError(null);
    try {
      const result = await cropToFile(src, area, output, file.name, { placement: product ? placement : "fill", original: file });
      const invalid = validateImageFile(result, kind);
      if (invalid) throw new Error(invalid);
      onDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر قص الصورة.");
    } finally { setWorking(false); }
  };

  const assess = async () => {
    if (!src || !area || !file || dimensionError) return;
    const id = ++assessReq.current;
    setAssessing(true); setAssessError(null); setAssessment(null);
    try {
      // Only the AI transport copy is reduced; the approved upload is never changed.
      const aiSize = originalDimensions(output.width, output.height);
      const scale = Math.min(1, 1600 / Math.max(aiSize.width, aiSize.height));
      const cropped = await cropToFile(src, area, { ...output, width: Math.max(1, Math.round(output.width * scale)), height: Math.max(1, Math.round(output.height * scale)) }, file.name, { placement, assessmentOnly: true });
      const image = await fileToDataUrl(cropped);
      const { data, error } = await supabase.functions.invoke("assess-product-image", { body: { image } });
      if (error) {
        let msg = "تعذّر فحص الصورة حاليًا.";
        if (error instanceof FunctionsHttpError) {
          try { msg = (await error.context.json())?.error ?? msg; } catch { /* keep */ }
        }
        throw new Error(msg);
      }
      if (id === assessReq.current) setAssessment(data.assessment as Assessment);
    } catch (e) {
      if (id === assessReq.current) setAssessError(e instanceof Error ? e.message : "تعذّر فحص الصورة حاليًا.");
    } finally {
      if (id === assessReq.current) setAssessing(false);
    }
  };

  return (
    <Dialog open={!!file} onOpenChange={(o) => { if (!o && !working) onDone(null); }}>
      <DialogContent dir="rtl" className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>قص ومعاينة {preset.label}</DialogTitle>
          <DialogDescription>
            سيتم حفظ الصورة بمقاس {output.width} × {output.height} بكسل.{product ? " الحد الأقصى 8000 بكسل لكل جانب." : ""}
          </DialogDescription>
        </DialogHeader>

        {product && <div className="grid min-w-0 grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="crop-width">العرض (بكسل)</Label><Input id="crop-width" dir="ltr" type="number" min={1} max={MAX_CROP_SIDE} step={1} value={dimensions.width || ""} onChange={(e) => changeDimension("width", Number(e.target.value))} /></div>
          <div className="space-y-1"><Label htmlFor="crop-height">الارتفاع (بكسل)</Label><Input id="crop-height" dir="ltr" type="number" min={1} max={MAX_CROP_SIDE} step={1} value={dimensions.height || ""} onChange={(e) => changeDimension("height", Number(e.target.value))} /></div>
          <Select value={ratio} onValueChange={chooseRatio}><SelectTrigger className="col-span-2" aria-label="نسبة القص"><SelectValue /></SelectTrigger><SelectContent>{RATIOS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select>
          <Button type="button" size="sm" variant={placement === "fit" ? "default" : "outline"} aria-pressed={placement === "fit"} onClick={() => { setPlacement("fit"); setCrop({ x: 0, y: 0 }); setZoom(1); }}><Maximize className="me-1 h-4 w-4" />ملاءمة الصورة</Button>
          <Button type="button" size="sm" variant={placement === "fill" ? "default" : "outline"} aria-pressed={placement === "fill"} onClick={() => { setPlacement("fill"); setCrop({ x: 0, y: 0 }); setZoom(1); }}><Scan className="me-1 h-4 w-4" />ملء المساحة</Button>
        </div>}
        {dimensionError && <p role="alert" className="text-sm text-destructive">{dimensionError}</p>}
        <div ref={frameRef} className="relative h-56 w-full overflow-hidden rounded-md bg-muted sm:h-80">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropSize={product ? cropSize : undefined}
              cropShape={kind === "logo" ? "round" : "rect"}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
              style={product && placement === "fit" ? { containerStyle: { visibility: "hidden" } } : undefined}
            />
          )}
          {product && placement === "fit" && src && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background" style={{ width: cropSize.width, height: cropSize.height }}><img src={src} alt="معاينة الصورة كاملة" className="h-full w-full object-contain" /></div>}
          {product && placement === "fill" && ratio === "free" && <Button type="button" size="icon" variant="secondary" className="absolute z-10 touch-none" style={{ right: (frame.width - cropSize.width) / 2, bottom: (frame.height - cropSize.height) / 2 }} aria-label="تغيير إطار القص الحر" title="تغيير إطار القص الحر" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); resizeStart.current = { x: e.clientX, y: e.clientY, ...dimensions }; }} onPointerMove={(e) => { const start = resizeStart.current; if (!start) return; const scale = start.width / cropSize.width; setDimensions({ width: Math.max(1, Math.min(MAX_CROP_SIDE, Math.round(start.width - (e.clientX - start.x) * scale))), height: Math.max(1, Math.min(MAX_CROP_SIDE, Math.round(start.height + (e.clientY - start.y) * scale))) }); }} onPointerUp={() => { resizeStart.current = null; }} onPointerCancel={() => { resizeStart.current = null; }}><MoveDiagonal className="h-4 w-4" /></Button>}
        </div>
        <div className="flex items-center gap-3">
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Slider value={[zoom]} min={1} max={10} step={0.05} disabled={product && placement === "fit"} onValueChange={(v) => setZoom(v[0] ?? 1)} aria-label="تكبير" />
        </div>

        {kind === "product" && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">فحص جودة الصورة بالذكاء الاصطناعي</p>
                <Button type="button" size="sm" variant="outline" onClick={() => void assess()} disabled={assessing || !area || !!dimensionError}>
                {assessing ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <Sparkles className="me-1 h-4 w-4" />}
                {assessing ? "جارٍ الفحص..." : "افحص الصورة"}
              </Button>
            </div>
            {assessError && <p className="text-sm text-destructive">{assessError}</p>}
            {assessment && (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={VERDICT[assessment.verdict].variant}>{VERDICT[assessment.verdict].label}</Badge>
                  <span className="font-semibold">{assessment.score}/100</span>
                  <span className="text-muted-foreground">
                    الوضوح: {LEVEL[assessment.clarity]} · الإضاءة: {LEVEL[assessment.lighting]} · الخلفية: {LEVEL[assessment.background]}
                  </span>
                </div>
                <p>{assessment.summary}</p>
                {assessment.issues.length > 0 && (
                  <ul className="list-disc space-y-0.5 ps-5 text-destructive">{assessment.issues.map((i, n) => <li key={n}>{i}</li>)}</ul>
                )}
                {assessment.suggestions.length > 0 && (
                  <ul className="list-disc space-y-0.5 ps-5 text-muted-foreground">{assessment.suggestions.map((i, n) => <li key={n}>{i}</li>)}</ul>
                )}
                <p className="text-xs text-muted-foreground">التقييم استرشادي ولا يمنع رفع الصورة.</p>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onDone(null)} disabled={working}>إلغاء</Button>
          <Button type="button" onClick={() => void confirm()} disabled={working || !area || !!dimensionError}>
            {working && <Loader2 className="me-1 h-4 w-4 animate-spin" />}اعتماد الصورة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropDialog;

/** Promise-based helper: `await crop(file)` resolves to the cropped file, or null when cancelled. */
export const useImageCropper = (kind: ImageKind) => {
  const [file, setFile] = useState<File | null>(null);
  const resolver = useRef<((f: File | null) => void) | null>(null);
  const crop = useCallback((f: File) => new Promise<File | null>((resolve) => {
    resolver.current = resolve;
    setFile(f);
  }), []);
  const dialog = (
    <ImageCropDialog
      file={file}
      kind={kind}
      onDone={(f) => { resolver.current?.(f); resolver.current = null; setFile(null); }}
    />
  );
  return { crop, dialog };
};

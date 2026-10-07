import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Loader2, Sparkles, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CROP_PRESETS, cropToFile, fileToDataUrl, type PixelArea } from "@/lib/imageCrop";
import type { ImageKind } from "@/lib/uploadErrors";

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

  useEffect(() => {
    if (!file) { setSrc(null); return; }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setCrop({ x: 0, y: 0 }); setZoom(1); setError(null); setAssessment(null); setAssessError(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: unknown, px: PixelArea) => { setArea(px); setAssessment(null); }, []);

  const confirm = async () => {
    if (!src || !area || !file) return;
    setWorking(true); setError(null);
    try {
      onDone(await cropToFile(src, area, preset, file.name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر قص الصورة.");
    } finally { setWorking(false); }
  };

  const assess = async () => {
    if (!src || !area || !file) return;
    const id = ++assessReq.current;
    setAssessing(true); setAssessError(null); setAssessment(null);
    try {
      const cropped = await cropToFile(src, area, preset, file.name);
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
      <DialogContent dir="rtl" className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>قص ومعاينة {preset.label}</DialogTitle>
          <DialogDescription>
            سيتم حفظ الصورة بمقاس {preset.width} × {preset.height} بكسل. اسحب الصورة وكبّرها لاختيار الجزء الظاهر.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-64 w-full overflow-hidden rounded-md bg-muted sm:h-80">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={preset.width / preset.height}
              cropShape={kind === "logo" ? "round" : "rect"}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Slider value={[zoom]} min={1} max={4} step={0.05} onValueChange={(v) => setZoom(v[0])} aria-label="تكبير" />
        </div>

        {kind === "product" && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">فحص جودة الصورة بالذكاء الاصطناعي</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void assess()} disabled={assessing || !area}>
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
          <Button type="button" onClick={() => void confirm()} disabled={working || !area}>
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

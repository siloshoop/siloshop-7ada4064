import { Capacitor } from "@capacitor/core";
import { isCancelError } from "@/lib/share";

export type ExportResult = "downloaded" | "shared" | "cancelled";

export const CSV_MIME = "text/csv;charset=utf-8";

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV with UTF-8 BOM so Excel/Sheets open Arabic text correctly. */
export const buildCsv = (headers: string[], rows: unknown[][]): string =>
  "\uFEFF" + [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");

export const recordsToCsv = (rows: Record<string, unknown>[]): string => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return buildCsv(headers, rows.map((r) => headers.map((h) => r[h])));
};

export const safeFilename = (name: string) => name.replace(/[\\/:*?"<>|\s]+/g, "-");

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error ?? new Error("تعذر قراءة الملف"));
    r.readAsDataURL(blob);
  });

/**
 * Save a generated file. Web: real browser download. Android/iOS: write to the app cache
 * and open the native share sheet (save to Files/Drive, send via WhatsApp, etc.).
 * Throws on failure; resolves only after the file was actually produced/handed off.
 */
export const exportFile = async (
  data: Blob | string,
  filename: string,
  mime: string = CSV_MIME,
): Promise<ExportResult> => {
  const blob = typeof data === "string" ? new Blob([data], { type: mime }) : data;
  if (!blob.size) throw new Error("لا توجد بيانات للتصدير");
  const name = safeFilename(filename);

  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const written = await Filesystem.writeFile({
      path: name,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
      recursive: true,
    });
    try {
      await Share.share({ title: name, files: [written.uri], dialogTitle: name });
      return "shared";
    } catch (e) {
      if (isCancelError(e)) return "cancelled";
      throw e;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke later so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return "downloaded";
};

export const canvasToBlob = (canvas: HTMLCanvasElement, type = "image/png") =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b && b.size ? resolve(b) : reject(new Error("تعذر إنشاء الصورة"))), type),
  );

/**
 * Printable HTML documents (invoices, labels). Web: open the print dialog (Save as PDF).
 * Native WebViews cannot print popups, so the HTML file is exported via the share sheet instead.
 */
export const printOrExportHtml = async (html: string, filename: string): Promise<ExportResult | "printed"> => {
  if (Capacitor.isNativePlatform()) {
    const cleaned = html.replace(/<script>[\s\S]*?<\/script>/g, "");
    return exportFile(cleaned, filename, "text/html;charset=utf-8");
  }
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) throw new Error("يرجى السماح بالنوافذ المنبثقة والمحاولة مجددًا");
  w.document.open();
  w.document.write(html);
  w.document.close();
  return "printed";
};

export const exportSuccessMessage = (r: ExportResult | "printed") =>
  r === "shared" ? "تم تجهيز الملف ومشاركته" : r === "printed" ? "تم فتح نافذة الطباعة" : "تم تنزيل الملف";

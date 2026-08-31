import { supabase } from "@/integrations/supabase/client";

export const CHAT_BUCKET = "chat-files";
export const MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_CHAT_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

export interface ChatAttachmentInput {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
}

export interface ChatAttachment extends ChatAttachmentInput {
  id: string;
  kind: "image" | "file";
}

/** Client-side image compression (max 1600px, JPEG q0.82) before upload. */
export const compressChatImage = (
  file: File,
): Promise<{ file: File; width: number; height: number }> =>
  new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
      resolve({ file, width: 0, height: 0 });
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve({ file, width: img.width, height: img.height });
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob || blob.size >= file.size) {
            resolve({ file, width: img.width, height: img.height });
            return;
          }
          const out = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, "") + ".jpg",
            { type: "image/jpeg" },
          );
          resolve({ file: out, width: w, height: h });
        },
        "image/jpeg",
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ file, width: 0, height: 0 });
    };
    img.src = url;
  });

const safeName = (name: string) =>
  name.replace(/[^\w.\-\u0600-\u06FF]+/g, "_").slice(-80);

/** Uploads files into the private chat bucket under `<conversationId>/`. */
export const uploadChatFiles = async (
  conversationId: string,
  files: File[],
): Promise<{ attachments: ChatAttachmentInput[]; errors: string[] }> => {
  const attachments: ChatAttachmentInput[] = [];
  const errors: string[] = [];

  for (const raw of files) {
    if (!ALLOWED_CHAT_MIME.includes(raw.type)) {
      errors.push(`${raw.name}: نوع ملف غير مدعوم`);
      continue;
    }
    const { file, width, height } = await compressChatImage(raw);
    if (file.size > MAX_CHAT_FILE_BYTES) {
      errors.push(`${raw.name}: الحجم يتجاوز 10 ميغابايت`);
      continue;
    }
    const path = `${conversationId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName(file.name)}`;
    const { error } = await supabase.storage
      .from(CHAT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      const msg = /row-level security|Unauthorized|AccessDenied/i.test(error.message)
        ? "لا تملك صلاحية الرفع في هذه المحادثة"
        : error.message || "تعذر الرفع";
      errors.push(`${raw.name}: ${msg}`);
      continue;
    }
    attachments.push({
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      width: width || null,
      height: height || null,
    });
  }

  return { attachments, errors };
};

const signedCache = new Map<string, { url: string; expires: number }>();

/** Signed URL for a private chat file (or the raw value for legacy public URLs). */
export const getChatFileUrl = async (pathOrUrl: string): Promise<string | null> => {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;

  const cached = signedCache.get(pathOrUrl);
  if (cached && cached.expires > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(CHAT_BUCKET)
    .createSignedUrl(pathOrUrl, 3600);
  if (error || !data?.signedUrl) return null;

  signedCache.set(pathOrUrl, {
    url: data.signedUrl,
    expires: Date.now() + 55 * 60 * 1000,
  });
  return data.signedUrl;
};

export const formatBytes = (bytes: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

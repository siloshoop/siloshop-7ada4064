import type { SyntheticEvent } from "react";

/**
 * Smaller, modern-format copies of pictures saved in the app's file storage.
 *
 * Public storage pictures are served at their uploaded size (often 1000px+ JPEGs
 * of 150 KB or more) even when shown as a 180px card. The storage server can
 * resize on request and returns WebP to browsers that accept it, so listings
 * download roughly a fifth of the bytes. The saved file is never changed, and
 * every resized picture falls back to the original if the resize fails.
 */

const STORAGE_BASE = `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "")}/storage/v1`;
const OBJECT_PREFIX = `${STORAGE_BASE}/object/public/`;
const RENDER_PREFIX = `${STORAGE_BASE}/render/image/public/`;
// Formats the resizer handles; animated/vector pictures keep their original file.
const RESIZABLE = /\.(jpe?g|png|webp|avif)$/i;

export const isResizableStorageImage = (url?: string | null): url is string => {
  if (!url || !STORAGE_BASE.startsWith("http") || !url.startsWith(OBJECT_PREFIX)) return false;
  const path = url.slice(OBJECT_PREFIX.length).split(/[?#]/)[0];
  return RESIZABLE.test(path);
};

/** A resized copy `width` CSS pixels wide (aspect ratio kept), or the original URL. */
export const resizedImageUrl = (url: string | null | undefined, width: number, quality = 70): string => {
  if (!url) return "";
  if (!isResizableStorageImage(url)) return url;
  const [base, query = ""] = url.slice(OBJECT_PREFIX.length).split("?");
  const params = new URLSearchParams(query);
  params.set("width", String(Math.round(width)));
  params.set("resize", "contain");
  params.set("quality", String(quality));
  return `${RENDER_PREFIX}${base}?${params.toString()}`;
};

export interface ResponsiveImageProps {
  src: string;
  srcSet?: string;
  sizes?: string;
  "data-original-src"?: string;
}

/**
 * `src`/`srcSet`/`sizes` for an <img>. `widths` are the candidate pixel widths;
 * the browser picks one for the shown size and screen density.
 */
export const responsiveImage = (
  url: string | null | undefined,
  widths: number[],
  sizes: string,
  quality = 70,
): ResponsiveImageProps => {
  if (!isResizableStorageImage(url)) return { src: url || "" };
  const sorted = [...widths].sort((a, b) => a - b);
  return {
    src: resizedImageUrl(url, sorted[Math.min(1, sorted.length - 1)], quality),
    srcSet: sorted.map((w) => `${resizedImageUrl(url, w, quality)} ${w}w`).join(", "),
    sizes,
    "data-original-src": url,
  };
};

/**
 * onError helper: when a resized copy fails, retry once with the original file.
 * Returns true when it switched to the original, so callers can skip their own
 * placeholder fallback for that first failure.
 */
export const retryWithOriginalImage = (event: SyntheticEvent<HTMLImageElement>): boolean => {
  const img = event.currentTarget;
  const original = img.dataset.originalSrc;
  if (!original || img.dataset.fellBack === "1") return false;
  img.dataset.fellBack = "1";
  img.removeAttribute("srcset");
  img.removeAttribute("sizes");
  img.src = original;
  return true;
};

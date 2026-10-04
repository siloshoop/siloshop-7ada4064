import { Capacitor } from "@capacitor/core";
import { getPublicOrigin } from "@/lib/shareUrl";

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";
export type SharePlatform = "whatsapp" | "twitter" | "facebook" | "telegram";

const LOCAL_URL = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i;

/**
 * Turn any path or URL into a public, shareable production URL.
 * Local/internal origins (Android WebView https://localhost, preview hosts) are rewritten.
 */
export const toPublicUrl = (pathOrUrl: string): string => {
  const origin = getPublicOrigin();
  try {
    const u = new URL(pathOrUrl, origin);
    if (LOCAL_URL.test(u.href) || u.hostname.includes("lovable") || u.protocol !== "https:") {
      return `${origin}${u.pathname}${u.search}${u.hash}`;
    }
    return u.href;
  } catch {
    return origin;
  }
};

export const isCancelError = (e: unknown) => {
  const name = (e as { name?: string })?.name;
  const msg = String((e as { message?: string })?.message ?? e ?? "").toLowerCase();
  return name === "AbortError" || msg.includes("cancel") || msg.includes("abort");
};

export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy copy */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
};

/** Native share sheet on Android/iOS, Web Share API in browsers, clipboard fallback otherwise. */
export const shareContent = async (opts: { title?: string; text?: string; url: string }): Promise<ShareResult> => {
  const url = toPublicUrl(opts.url);
  try {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: opts.title, text: opts.text, url, dialogTitle: opts.title });
      return "shared";
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: opts.title, text: opts.text, url });
      return "shared";
    }
  } catch (e) {
    if (isCancelError(e)) return "cancelled";
    // fall back to copying below
  }
  const ok = await copyText(opts.text ? `${opts.text}\n${url}` : url);
  return ok ? "copied" : "failed";
};

export const buildSocialShareUrl = (platform: SharePlatform, url: string, text = ""): string => {
  const u = encodeURIComponent(toPublicUrl(url));
  const t = encodeURIComponent(text);
  switch (platform) {
    case "whatsapp":
      return `https://wa.me/?text=${text ? `${t}%20` : ""}${u}`;
    case "twitter":
      return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "telegram":
      return `https://t.me/share/url?url=${u}&text=${t}`;
  }
};

/** Opens a social share URL; in the Android app this hands off to the external app/browser. */
export const openSocialShare = (platform: SharePlatform, url: string, text = ""): boolean => {
  const href = buildSocialShareUrl(platform, url, text);
  const w = window.open(href, "_blank", "noopener,noreferrer");
  if (!w && !Capacitor.isNativePlatform()) {
    window.location.href = href;
  }
  return true;
};

import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Inside the Android app the phone's system text size scales the root font size, so every
 * rem-based size (text, fields, buttons, icons, pictures and spacing) grows together and
 * nothing overlaps. The website is unchanged: the browser handles its own zoom.
 */
export const MIN_APP_FONT_SCALE = 1;
export const MAX_APP_FONT_SCALE = 1.3;
const STORAGE_KEY = "siloshop:app-font-scale";

interface FontScalePlugin {
  get(): Promise<{ scale: number }>;
}

const SiloShopFontScale = registerPlugin<FontScalePlugin>("SiloShopFontScale");

/** Phone sizes below the design size keep the design size; very large sizes stop at the max. */
export const clampAppFontScale = (scale: unknown): number => {
  const n = typeof scale === "number" ? scale : Number(scale);
  if (!Number.isFinite(n) || n <= 0) return MIN_APP_FONT_SCALE;
  return Math.round(Math.min(MAX_APP_FONT_SCALE, Math.max(MIN_APP_FONT_SCALE, n)) * 100) / 100;
};

export const applyAppFontScale = (scale: unknown, root: HTMLElement = document.documentElement) => {
  const value = clampAppFontScale(scale);
  if (value === MIN_APP_FONT_SCALE) {
    root.style.removeProperty("font-size");
    root.removeAttribute("data-app-font-scaled");
  } else {
    root.style.fontSize = `${Math.round(value * 100)}%`;
    // Lets enlarged-text layouts stack items that only fit side by side at the design size.
    root.setAttribute("data-app-font-scaled", "");
  }
  root.style.setProperty("--app-font-scale", String(value));
  return value;
};

const refreshFromPhone = async () => {
  try {
    const { scale } = await SiloShopFontScale.get();
    const value = applyAppFontScale(scale);
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* storage unavailable */ }
  } catch {
    // Older app builds without the plugin keep the design size.
  }
};

/** Apply the last known size immediately (no jump on launch), then read the current phone setting. */
export const initAppFontScale = () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) applyAppFontScale(Number(saved));
  } catch { /* storage unavailable */ }
  void refreshFromPhone();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshFromPhone();
  });
};

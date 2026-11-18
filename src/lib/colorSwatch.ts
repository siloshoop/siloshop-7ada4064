// Maps saved color option names (Arabic or English, as sellers type them) to a swatch color.
// These are product colors (data), not theme colors, so they are plain CSS color values.

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "") // harakat + tatweel
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");

const stripArticle = (word: string) => (word.startsWith("ال") && word.length > 3 ? word.slice(2) : word);

const SWATCHES: Record<string, string> = {
  اسود: "#111111", black: "#111111",
  ابيض: "#ffffff", white: "#ffffff",
  احمر: "#dc2626", red: "#dc2626",
  ازرق: "#2563eb", blue: "#2563eb",
  اخضر: "#16a34a", green: "#16a34a",
  اصفر: "#facc15", yellow: "#facc15",
  برتقالي: "#f97316", orange: "#f97316",
  زهري: "#ec4899", وردي: "#f472b6", pink: "#ec4899",
  بنفسجي: "#8b5cf6", ليلكي: "#c4b5fd", purple: "#8b5cf6", lilac: "#c4b5fd",
  موف: "#a78bfa", mauve: "#a78bfa",
  بني: "#7c4a21", brown: "#7c4a21",
  بيج: "#d9c3a0", beige: "#d9c3a0",
  رمادي: "#9ca3af", gray: "#9ca3af", grey: "#9ca3af",
  كحلي: "#1e3a5f", navy: "#1e3a5f",
  عنابي: "#7f1d1d", maroon: "#7f1d1d",
  خمري: "#6d1a36", burgundy: "#6d1a36", wine: "#6d1a36",
  تركوازي: "#14b8a6", فيروزي: "#14b8a6", turquoise: "#14b8a6",
  ذهبي: "#d4af37", دهبي: "#d4af37", gold: "#d4af37", golden: "#d4af37",
  فضي: "#c0c0c0", silver: "#c0c0c0",
  سماوي: "#38bdf8", sky: "#38bdf8",
  زيتي: "#6b7a2a", olive: "#6b7a2a",
  كريمي: "#f5ecd7", cream: "#f5ecd7",
  نيلي: "#3730a3", indigo: "#3730a3",
  عسلي: "#c68e3d",
  فوشي: "#d946ef", fuchsia: "#d946ef",
  كاكي: "#b5a26b", خاكي: "#b5a26b", هاكي: "#b5a26b", khaki: "#b5a26b",
  جملي: "#c19a6b", كاميل: "#c19a6b", camel: "#c19a6b",
  كريم: "#f5ecd7",
  بورغندي: "#6d1a36", برغندي: "#6d1a36", بوردو: "#6d1a36",
  انتراسيت: "#3b3f45", anthracite: "#3b3f45",
  "نايت بلاك": "#111111", بلاك: "#111111",
  "ازرق بحري": "#1e3a5f", بحري: "#1e3a5f",
  "ازرق سماوي": "#38bdf8",
  زرق: "#2563eb",
  نحاسي: "#b87333", copper: "#b87333",
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// Shade words sellers add after a color, e.g. «رمادي فاتح» / «أزرق غامق».
const LIGHT = new Set(["فاتح", "light"]);
const DARK = new Set(["داكن", "غامق", "dark"]);

const mix = (hex: string, target: number, amount: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (target - c) * amount));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
};

/** Swatch color for a saved color name, or null when the name is not a known color. */
export function colorSwatch(name: string): string | null {
  const raw = name.trim();
  if (HEX.test(raw)) return raw;
  const words = normalize(raw).split(" ").filter(Boolean).map(stripArticle);
  const whole = words.join(" ");
  if (SWATCHES[whole]) return SWATCHES[whole];
  const shade = words.find((w) => LIGHT.has(w) || DARK.has(w));
  const base = words.filter((w) => !LIGHT.has(w) && !DARK.has(w));
  const color = SWATCHES[base.join(" ")] ?? SWATCHES[base[0]] ?? null;
  if (!color || !shade || color.length !== 7) return color;
  return LIGHT.has(shade) ? mix(color, 255, 0.45) : mix(color, 0, 0.4);
}

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
  كاكي: "#b5a26b", khaki: "#b5a26b",
  جملي: "#c19a6b", camel: "#c19a6b",
  نحاسي: "#b87333", copper: "#b87333",
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Swatch color for a saved color name, or null when the name is not a known color. */
export function colorSwatch(name: string): string | null {
  const raw = name.trim();
  if (HEX.test(raw)) return raw;
  const words = normalize(raw).split(" ").map(stripArticle);
  const whole = words.join(" ");
  return SWATCHES[whole] ?? SWATCHES[words[0]] ?? null;
}

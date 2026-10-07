const ARABIC_DIACRITICS_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

const ARABIC_LETTER_VARIANTS: Array<[RegExp, string]> = [
  [/[أإآٱ]/g, "ا"],
  [/[ؤ]/g, "و"],
  [/[ئ]/g, "ي"],
  [/[ى]/g, "ي"],
  [/[ة]/g, "ه"],
];

export const normalizeSearchTerm = (value: string) => {
  let normalized = value.toLowerCase().trim().replace(ARABIC_DIACRITICS_REGEX, "");

  ARABIC_LETTER_VARIANTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  return normalized.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
};

export const matchesSearchTerm = (text: string | null | undefined, query: string) => {
  if (!query.trim()) {
    return true;
  }

  return normalizeSearchTerm(text ?? "").includes(normalizeSearchTerm(query));
};

/** Letters typed in several ways in Arabic — matched with a single-char wildcard on the server. */
const FUZZY_LETTERS = /[اأإآٱءؤئوىيةه]/g;

/**
 * Splits a query into tolerant ILIKE patterns (one per word): diacritics removed,
 * Arabic letter variants become "_", the "ال" article is optional. Every word must match.
 */
export const buildFuzzyPatterns = (query: string): string[] =>
  query
    .replace(ARABIC_DIACRITICS_REGEX, "")
    .replace(/[%,()*\\"'.:]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => (w.startsWith("ال") && w.length > 4 ? w.slice(2) : w))
    .map((w) => {
      const fuzzy = w.replace(FUZZY_LETTERS, "_");
      return `%${/[^_]/.test(fuzzy) ? fuzzy : w}%`;
    })
    .slice(0, 5);
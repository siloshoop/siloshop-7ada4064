const STORAGE_KEY = "recent_searches_v1";
const MAX_ITEMS = 8;

export const getRecentSearches = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string").slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
};

export const addRecentSearch = (term: string): string[] => {
  const value = term.trim();
  if (!value) return getRecentSearches();
  const next = [value, ...getRecentSearches().filter((v) => v.toLowerCase() !== value.toLowerCase())].slice(
    0,
    MAX_ITEMS,
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
  window.dispatchEvent(new CustomEvent("recent-searches-updated"));
  return next;
};

export const removeRecentSearch = (term: string): string[] => {
  const next = getRecentSearches().filter((v) => v !== term);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("recent-searches-updated"));
  return next;
};

export const clearRecentSearches = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("recent-searches-updated"));
};
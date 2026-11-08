/**
 * Unsaved form drafts kept in sessionStorage so a closed (or reloaded) form can
 * be reopened without losing what was typed. Storage failures are ignored.
 */
const PREFIX = "siloshop:draft:";

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: keep working without a draft */
  }
}

export function clearDraft(key: string) {
  try {
    window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

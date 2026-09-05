import { useEffect } from "react";

/**
 * Lightweight cross-component sync bus.
 *
 * Several independent components read the same server state (cart, favorites,
 * comparison list). After a successful mutation the mutating component calls
 * `notifySync(topic)` and every mounted listener refetches, so counters and
 * lists update instantly without a page reload.
 *
 * Legacy event names are kept as aliases so older listeners keep working.
 */
export type SyncTopic = "cart" | "favorites" | "compare";

const EVENT_ALIASES: Record<SyncTopic, string[]> = {
  cart: ["cart-updated", "cart:updated"],
  favorites: ["favorites-updated", "favorites:updated"],
  compare: ["compare-products-updated"],
};

export const notifySync = (...topics: SyncTopic[]) => {
  if (typeof window === "undefined") return;
  topics.forEach((topic) => {
    EVENT_ALIASES[topic].forEach((name) => window.dispatchEvent(new Event(name)));
  });
};

/** Runs `handler` whenever any of the given topics changes anywhere in the app. */
export const useSyncListener = (topics: SyncTopic[], handler: () => void) => {
  const key = topics.join("|");
  useEffect(() => {
    const names = key.split("|").flatMap((t) => EVENT_ALIASES[t as SyncTopic] ?? []);
    const unique = Array.from(new Set(names));
    unique.forEach((name) => window.addEventListener(name, handler));
    return () => unique.forEach((name) => window.removeEventListener(name, handler));
  }, [key, handler]);
};

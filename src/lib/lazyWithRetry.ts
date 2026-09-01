import { lazy, type ComponentType } from "react";

/**
 * Route-level lazy loader that survives transient chunk failures (flaky network
 * or a stale chunk after a deploy) instead of leaving a blank page that only
 * opens after several manual refreshes.
 */
export const lazyWithRetry = <T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) =>
  lazy(async () => {
    const attempt = async (retriesLeft: number): Promise<{ default: T }> => {
      try {
        return await factory();
      } catch (error) {
        if (retriesLeft <= 0) {
          // Stale chunk after a new deploy: reload once so the fresh manifest is used.
          const key = "chunk-reload-at";
          const last = Number(sessionStorage.getItem(key) ?? 0);
          if (Date.now() - last > 10_000) {
            sessionStorage.setItem(key, String(Date.now()));
            window.location.reload();
          }
          throw error;
        }
        await new Promise((r) => setTimeout(r, 350));
        return attempt(retriesLeft - 1);
      }
    };
    return attempt(2);
  });

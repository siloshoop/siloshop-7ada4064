import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

// Must never return a value: React treats an effect's return value as its cleanup.
const resetScroll = (): void => {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
};

export default function PageScrollReset() {
  const { key, pathname, search } = useLocation();

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    // Also cover browser back/forward cache restores, which do not remount React.
    window.addEventListener("pageshow", resetScroll);
    return () => {
      window.history.scrollRestoration = previous;
      window.removeEventListener("pageshow", resetScroll);
    };
  }, []);

  useLayoutEffect(() => {
    resetScroll();
  }, [key, pathname, search]);
  return null;
}
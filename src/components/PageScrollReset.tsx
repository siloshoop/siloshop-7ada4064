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
    // A menu/sheet that unmounts mid-navigation can leave its page lock behind,
    // which makes every tap do nothing. Clear any stale lock on page change.
    const { body } = document;
    if (body.style.pointerEvents === "none") body.style.pointerEvents = "";
    body.removeAttribute("data-scroll-locked");
    if (body.style.overflow === "hidden") body.style.overflow = "";
  }, [key, pathname, search]);
  return null;
}
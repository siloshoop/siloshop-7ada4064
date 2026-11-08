import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { PRODUCTION_ORIGIN } from "@/lib/shareUrl";

/** Canonical address for a path: always the primary www host, no query/hash, no trailing slash. */
export const canonicalFor = (pathname: string): string => {
  const clean = pathname.replace(/\/+$/, "");
  return `${PRODUCTION_ORIGIN}${clean || "/"}`;
};

/**
 * Keeps <link rel="canonical"> and og:url pointing at the current page instead of the
 * homepage value baked into index.html. Pages with their own SeoHead (e.g. Product) may
 * override it after this runs.
 */
export default function RouteCanonical() {
  const { pathname } = useLocation();

  useEffect(() => {
    const href = canonicalFor(pathname);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", href);
    document.head.querySelector('meta[property="og:url"]')?.setAttribute("content", href);
  }, [pathname]);

  return null;
}

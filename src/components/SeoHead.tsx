import { useEffect } from "react";

interface SeoHeadProps {
  title: string;
  description?: string;
  keywords?: string | string[] | null;
  canonicalUrl?: string;
  ogImage?: string | null;
  ogType?: string;
  jsonLd?: Record<string, any> | null;
}

/**
 * Injects SEO-related tags (title, meta, canonical, Open Graph, Twitter, JSON-LD)
 * into the document head and cleans them up on unmount / update.
 */
const SeoHead = ({
  title,
  description,
  keywords,
  canonicalUrl,
  ogImage,
  ogType = "website",
  jsonLd,
}: SeoHeadProps) => {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    const createdTags: HTMLElement[] = [];

    const setMeta = (attr: "name" | "property", key: string, content?: string | null) => {
      if (!content) return;
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        createdTags.push(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("name", "description", description);
    setMeta(
      "name",
      "keywords",
      Array.isArray(keywords) ? keywords.join(", ") : keywords || undefined
    );
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", ogType);
    setMeta("property", "og:image", ogImage);
    if (canonicalUrl) setMeta("property", "og:url", canonicalUrl);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", ogImage);

    let canonicalEl: HTMLLinkElement | null = null;
    let createdCanonical = false;
    if (canonicalUrl) {
      canonicalEl = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement("link");
        canonicalEl.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalEl);
        createdCanonical = true;
      }
      canonicalEl.setAttribute("href", canonicalUrl);
    }

    let scriptEl: HTMLScriptElement | null = null;
    if (jsonLd) {
      scriptEl = document.createElement("script");
      scriptEl.type = "application/ld+json";
      scriptEl.text = JSON.stringify(jsonLd);
      document.head.appendChild(scriptEl);
    }

    return () => {
      document.title = prevTitle;
      createdTags.forEach((el) => el.remove());
      if (createdCanonical && canonicalEl) canonicalEl.remove();
      if (scriptEl) scriptEl.remove();
    };
  }, [title, description, keywords, canonicalUrl, ogImage, ogType, jsonLd]);

  return null;
};

export default SeoHead;

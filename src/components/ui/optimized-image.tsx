import { ImgHTMLAttributes, useState } from "react";
import { cn } from "@/lib/utils";

export interface OptimizedImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "loading" | "src"> {
  src?: string | null;
  /** Mark the LCP/above-the-fold image: loads eagerly with high priority. */
  priority?: boolean;
  /** Wrapper classes (aspect ratio, rounding, etc.) to avoid layout shift. */
  wrapperClassName?: string;
  fallbackSrc?: string;
}

/**
 * Single source of truth for image rendering across the app:
 * - native lazy loading + async decoding (off-screen images cost nothing)
 * - explicit priority for the hero/LCP image
 * - shimmer placeholder that reserves space, so no layout shift (CLS)
 * - graceful fallback when a remote URL 404s
 */
const OptimizedImage = ({
  src,
  alt,
  priority = false,
  className,
  wrapperClassName,
  fallbackSrc = "/placeholder.svg",
  ...rest
}: OptimizedImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const resolved = failed || !src ? fallbackSrc : src;

  return (
    <span className={cn("relative block overflow-hidden bg-muted", wrapperClassName)}>
      {!loaded && (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-muted"
        />
      )}
      <img
        src={resolved}
        alt={alt ?? ""}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          setLoaded(true);
        }}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
        {...rest}
      />
    </span>
  );
};

export default OptimizedImage;
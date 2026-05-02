import { cn } from "@/lib/utils";

interface BrandLogoProps {
  /** Tailwind classes to control size/cursor/spacing — overrides defaults */
  className?: string;
  /** Render as <h1> for SEO in headers, otherwise <span> */
  as?: "h1" | "h2" | "span";
  onClick?: () => void;
}

/**
 * Unified SiloShop brand wordmark.
 * - Bold weight + primary→accent gradient
 * - Readable in both light/dark modes (no excess glow)
 * - Default sizing scales from mobile up; pass `className` to override
 */
export const BrandLogo = ({
  className,
  as = "span",
  onClick,
}: BrandLogoProps) => {
  const Tag = as as "h1" | "h2" | "span";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "font-extrabold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent select-none",
        onClick && "cursor-pointer",
        className,
      )}
    >
      SiloShop
    </Tag>
  );
};

export default BrandLogo;
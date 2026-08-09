import { Link } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  tone?: "primary" | "accent" | "success";
  className?: string;
}

const toneMap = {
  primary: { chip: "bg-primary/10 text-primary", bar: "from-primary to-accent" },
  accent: { chip: "bg-accent/10 text-accent", bar: "from-accent to-primary" },
  success: { chip: "bg-success/10 text-success", bar: "from-success to-primary" },
} as const;

const SectionHeader = ({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  href,
  hrefLabel = "عرض الكل",
  tone = "primary",
  className,
}: SectionHeaderProps) => {
  const t = toneMap[tone];

  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="space-y-1.5">
        {eyebrow && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide",
              t.chip,
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {eyebrow}
          </span>
        )}
        <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        <div className={cn("h-1 w-14 rounded-full bg-gradient-to-r", t.bar)} />
      </div>

      {href && (
        <Link
          to={href}
          className="group inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-semibold shadow-[var(--shadow-card)] transition-colors hover:border-primary/40 hover:text-primary"
        >
          {hrefLabel}
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      )}
    </div>
  );
};

export default SectionHeader;

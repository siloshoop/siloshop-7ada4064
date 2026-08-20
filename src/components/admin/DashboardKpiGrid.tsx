import { memo } from "react";
import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "success" | "warning" | "danger" | "primary";
}

const toneClasses: Record<NonNullable<Kpi["tone"]>, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

const KpiCard = memo(({ kpi }: { kpi: Kpi }) => {
  const body = (
    <Card className="h-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      <CardContent className="flex items-start gap-3 p-4">
        <span className={cn("rounded-lg p-2", toneClasses[kpi.tone ?? "default"])}>
          <kpi.icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{kpi.label}</p>
          <p className="mt-0.5 text-xl font-extrabold leading-tight">{kpi.value}</p>
          {kpi.hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{kpi.hint}</p>}
        </div>
      </CardContent>
    </Card>
  );

  return kpi.href ? (
    <Link to={kpi.href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
      {body}
    </Link>
  ) : (
    body
  );
});
KpiCard.displayName = "KpiCard";

const DashboardKpiGrid = ({ kpis }: { kpis: Kpi[] }) => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
    {kpis.map((kpi) => (
      <KpiCard key={kpi.label} kpi={kpi} />
    ))}
  </div>
);

export default memo(DashboardKpiGrid);

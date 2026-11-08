import { memo } from "react";
import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import StackedAmount, { isWideAmount } from "@/components/admin/StackedAmount";

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
  const wide = isWideAmount(kpi.value);
  const body = (
    <Card className="h-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant">
      <CardContent className="flex items-start gap-3 p-4">
        <span className={cn("shrink-0 rounded-xl p-2", toneClasses[kpi.tone ?? "default"])}>
          <kpi.icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-xs font-medium leading-snug text-muted-foreground">{kpi.label}</p>
          <p className={cn("mt-0.5 font-extrabold leading-tight", wide ? "text-lg sm:text-xl" : "text-xl")}>
            <StackedAmount value={kpi.value} />
          </p>
          {kpi.hint && <p className="mt-0.5 break-words text-[0.6875rem] leading-snug text-muted-foreground">{kpi.hint}</p>}
        </div>
      </CardContent>
    </Card>
  );

  const wrapperClass = wide ? "col-span-2 md:col-span-1" : undefined;

  return kpi.href ? (
    <Link to={kpi.href} className={cn("block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", wrapperClass)}>
      {body}
    </Link>
  ) : (
    <div className={wrapperClass}>{body}</div>
  );
});
KpiCard.displayName = "KpiCard";

const DashboardKpiGrid = ({ kpis }: { kpis: Kpi[] }) => (
  <div className="grid grid-flow-row-dense grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
    {kpis.map((kpi) => (
      <KpiCard key={kpi.label} kpi={kpi} />
    ))}
  </div>
);

export default memo(DashboardKpiGrid);

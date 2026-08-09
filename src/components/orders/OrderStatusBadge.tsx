import { cn } from "@/lib/utils";
import { getStatusMeta, statusClasses } from "@/lib/orderStatus";

interface Props {
  status?: string | null;
  className?: string;
  withIcon?: boolean;
}

/** Colour-coded order status badge driven by the --status-* design tokens. */
const OrderStatusBadge = ({ status, className, withIcon = true }: Props) => {
  const meta = getStatusMeta(status);
  const c = statusClasses(status);
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        c.badge,
        className,
      )}
      dir="rtl"
    >
      {withIcon && <Icon className="h-3.5 w-3.5" />}
      {meta.label}
    </span>
  );
};

export default OrderStatusBadge;
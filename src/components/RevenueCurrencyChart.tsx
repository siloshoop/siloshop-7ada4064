import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/currency";

type Point = { day: string; syp: number; usd: number };

const shortDate = (d: string) => new Date(d).toLocaleDateString("ar-SY", { day: "numeric", month: "short" });
const syp = (n: number) => formatPrice(n, "SYP");
const usd = (n: number) => formatPrice(n, "USD");

/**
 * Daily revenue with dollars and ل.س as separate lines on separate axes.
 * The two currencies are never added or converted.
 */
const RevenueCurrencyChart = ({ scope, days, reloadKey }: { scope: "admin" | "vendor"; days: number; reloadKey?: unknown }) => {
  const [data, setData] = useState<Point[] | null>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc("daily_revenue_by_currency", { _scope: scope, _days: days }).then(({ data }) => {
      if (!active) return;
      const rows = (data as unknown as Point[] | null) ?? [];
      setData(rows.map((r) => ({ day: shortDate(r.day), syp: Number(r.syp) || 0, usd: Number(r.usd) || 0 })));
    });
    return () => { active = false; };
  }, [scope, days, reloadKey]);

  if (!data) return <Skeleton className="h-full w-full" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="syp" orientation="right" tick={{ fontSize: 10 }} width={60} />
        <YAxis yAxisId="usd" orientation="left" tick={{ fontSize: 10 }} width={45} />
        <Tooltip
          formatter={(v: number, name: string) => (name === "دولار" ? usd(v) : syp(v))}
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, direction: "rtl" }}
        />
        <Legend />
        <Line yAxisId="syp" type="monotone" dataKey="syp" name="ل.س" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
        <Line yAxisId="usd" type="monotone" dataKey="usd" name="دولار" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default RevenueCurrencyChart;

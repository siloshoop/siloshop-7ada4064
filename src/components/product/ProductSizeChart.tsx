import { parseSizeChart } from "@/lib/productOptions";

/**
 * Buyer-facing size measurements table (cm). Wide charts scroll inside their
 * own container so they never widen the page.
 */
const ProductSizeChart = ({ chart, selectedSize }: { chart: unknown; selectedSize?: string | null }) => {
  const parsed = parseSizeChart(chart);
  if (!parsed) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-foreground">جدول القياسات (سم)</p>
      <div className="max-w-full overflow-x-auto rounded-lg border bg-background">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="px-3 py-2 text-start font-semibold">المقاس</th>
              {parsed.columns.map((c) => (
                <th key={c} scope="col" className="px-3 py-2 text-center font-semibold">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {parsed.rows.map((r) => {
              const active = selectedSize === r.size;
              return (
                <tr key={r.size} className={active ? "bg-selected/10" : undefined} aria-current={active ? "true" : undefined}>
                  <th scope="row" className={`px-3 py-2 text-start ${active ? "font-bold text-selected" : "font-semibold"}`}>
                    {r.size}
                  </th>
                  {parsed.columns.map((c) => (
                    <td key={c} dir="ltr" className="px-3 py-2 text-center tabular-nums">
                      {r.values[c] ?? "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductSizeChart;

export interface BarChartPoint {
  date: string;
  value: number;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Generic single-series daily bar chart, extracted from the Reports page's
 * original revenue chart so Advanced Analytics (patient growth) can reuse
 * it instead of a second copy. Single series, so no legend (the caller's
 * heading names it) and no categorical palette to validate — reuses the
 * app's existing `brand` color. Ships the two non-negotiable pieces for a
 * bar chart per the dataviz skill: a hover tooltip and an aria-label.
 * Scope cut: a table-view toggle and a dark-mode-validated variant are
 * deferred — this app has no dark mode anywhere yet (see README §
 * Frontend conventions), so a validated dark palette for one chart would be
 * inconsistent with the rest of the UI rather than more accessible.
 */
export function BarChart({
  points,
  ariaLabel,
  emptyMessage = "No data in this period.",
  formatValue = (v: number) => v.toFixed(2),
}: {
  points: BarChartPoint[];
  ariaLabel: string;
  emptyMessage?: string;
  formatValue?: (value: number) => string;
}) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  const maxValue = Math.max(...points.map((p) => p.value), 1);

  return (
    <div
      className="flex h-40 gap-1"
      role="img"
      aria-label={`${ariaLabel}, ${points.length} days, peak ${formatValue(maxValue)}`}
    >
      {points.map((point) => (
        <div key={point.date} className="group relative flex flex-1 flex-col justify-end">
          <div className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
            {formatDay(point.date)}: {formatValue(point.value)}
          </div>
          <div
            className="min-h-[4px] rounded-t bg-brand-500 group-hover:bg-brand-600"
            style={{ height: `${Math.max(4, (point.value / maxValue) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

// QA/security audit, 2026-07-22, TC-UX-02: reports aggregates a date range
// server-side before the page can render anything — without this, a slow
// response just shows a blank panel for however long that takes.
export default function ReportsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-6 w-40 rounded bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg border border-slate-200 bg-slate-100" />
        ))}
      </div>
      <div className="h-64 rounded-lg border border-slate-200 bg-slate-100" />
    </div>
  );
}

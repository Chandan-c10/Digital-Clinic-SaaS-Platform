// QA/security audit, 2026-07-22, TC-UX-02 — see the sibling reports/loading.tsx.
export default function AdvancedAnalyticsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-6 w-48 rounded bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-lg border border-slate-200 bg-slate-100" />
        ))}
      </div>
      <div className="h-48 rounded-lg border border-slate-200 bg-slate-100" />
      <div className="h-48 rounded-lg border border-slate-200 bg-slate-100" />
    </div>
  );
}

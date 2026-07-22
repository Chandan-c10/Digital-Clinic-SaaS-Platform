// QA/security audit, 2026-07-22, TC-UX-02 — see reports/loading.tsx.
export default function BillingLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-6 w-32 rounded bg-slate-200" />
      <div className="h-80 rounded-lg border border-slate-200 bg-slate-100" />
    </div>
  );
}

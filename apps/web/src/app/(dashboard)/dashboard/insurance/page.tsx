import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/session";
import { Tabs } from "@/components/ui/Tabs";
import type { InsuranceClaim, InsurancePolicy, InsuranceProvider, Invoice, Patient } from "@/lib/types";
import { NewProviderForm } from "./NewProviderForm";
import { NewPolicyForm } from "./NewPolicyForm";
import { FileClaimForm } from "./FileClaimForm";
import { RespondClaimForm } from "./RespondClaimForm";

const CLAIM_STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-amber-50 text-amber-700",
  APPROVED: "bg-blue-50 text-blue-700",
  PARTIALLY_APPROVED: "bg-blue-50 text-blue-700",
  PAID: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
};

export default async function InsurancePage() {
  const session = getSession();
  const isOwner = session?.role === "CLINIC_OWNER";
  const canRespond = session?.role === "CLINIC_OWNER" || session?.role === "ACCOUNTANT";

  const [providers, policies, claims, invoices, patients] = await Promise.all([
    apiFetch<InsuranceProvider[]>("/insurance/providers"),
    apiFetch<InsurancePolicy[]>("/insurance/policies"),
    apiFetch<InsuranceClaim[]>("/insurance/claims"),
    apiFetch<Invoice[]>("/billing/invoices"),
    apiFetch<Patient[]>("/patients"),
  ]);

  const claimableInvoices = invoices.filter((inv) => inv.status !== "PAID" && inv.status !== "CANCELLED");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Insurance</h1>
        <p className="text-sm text-slate-500">Providers, patient policies, and claims filed against invoices.</p>
      </div>

      <Tabs
        items={[
          {
            id: "providers",
            label: "Providers",
            content: (
              <div className="space-y-3">
                <div className="flex justify-end">{isOwner && <NewProviderForm />}</div>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {providers.length === 0 && (
                    <li className="text-sm text-slate-500">No providers yet.</li>
                  )}
                  {providers.map((p) => (
                    <li key={p.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-slate-500">{p.contactEmail ?? p.contactPhone ?? "—"}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          },
          {
            id: "policies",
            label: "Patient policies",
            content: (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <NewPolicyForm patients={patients} providers={providers} />
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Patient</th>
                        <th className="px-5 py-3 font-medium">Provider</th>
                        <th className="px-5 py-3 font-medium">Policy #</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {policies.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-5 py-6 text-center text-slate-500">
                            No policies on file.
                          </td>
                        </tr>
                      )}
                      {policies.map((p) => (
                        <tr key={p.id}>
                          <td className="px-5 py-3 text-slate-900">{p.patient?.name}</td>
                          <td className="px-5 py-3 text-slate-600">{p.provider.name}</td>
                          <td className="px-5 py-3 text-slate-600">{p.policyNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          },
          {
            id: "claims",
            label: "Claims",
            content: (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <FileClaimForm invoices={claimableInvoices} policies={policies} />
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Invoice</th>
                        <th className="px-5 py-3 font-medium">Provider</th>
                        <th className="px-5 py-3 font-medium">Claimed</th>
                        <th className="px-5 py-3 font-medium">Approved</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        {canRespond && <th className="px-5 py-3 font-medium">Respond</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {claims.length === 0 && (
                        <tr>
                          <td colSpan={canRespond ? 6 : 5} className="px-5 py-6 text-center text-slate-500">
                            No claims filed yet.
                          </td>
                        </tr>
                      )}
                      {claims.map((c) => (
                        <tr key={c.id}>
                          <td className="px-5 py-3 text-slate-900">#{c.invoice.invoiceNumber}</td>
                          <td className="px-5 py-3 text-slate-600">{c.policy.provider.name}</td>
                          <td className="px-5 py-3 text-slate-600">{Number(c.claimedAmount).toFixed(2)}</td>
                          <td className="px-5 py-3 text-slate-600">
                            {c.approvedAmount ? Number(c.approvedAmount).toFixed(2) : "—"}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${CLAIM_STATUS_STYLES[c.status]}`}
                            >
                              {c.status.replace("_", " ")}
                            </span>
                          </td>
                          {canRespond && (
                            <td className="px-5 py-3">
                              {c.status !== "PAID" && c.status !== "REJECTED" && (
                                <RespondClaimForm claimId={c.id} />
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

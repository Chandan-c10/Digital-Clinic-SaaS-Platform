import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Invoice, Patient } from "@/lib/types";
import { NewInvoiceForm } from "./NewInvoiceForm";

const STATUS_STYLES: Record<string, string> = {
  UNPAID: "bg-amber-50 text-amber-700",
  PARTIALLY_PAID: "bg-blue-50 text-blue-700",
  PAID: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default async function BillingPage() {
  const [invoices, patients] = await Promise.all([
    apiFetch<Invoice[]>("/billing/invoices"),
    apiFetch<Patient[]>("/patients"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Billing</h1>
        <NewInvoiceForm patients={patients} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Invoice</th>
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Paid</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-500">
                  No invoices yet.
                </td>
              </tr>
            )}
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-5 py-3 font-medium">
                  <Link
                    href={`/dashboard/billing/${invoice.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    #{invoice.invoiceNumber}
                  </Link>
                </td>
                <td className="px-5 py-3 text-slate-600">{invoice.patient.name}</td>
                <td className="px-5 py-3 text-slate-600">
                  {invoice.currency} {Number(invoice.totalAmount).toFixed(2)}
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {invoice.currency} {Number(invoice.amountPaid).toFixed(2)}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[invoice.status]}`}
                  >
                    {invoice.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {new Date(invoice.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

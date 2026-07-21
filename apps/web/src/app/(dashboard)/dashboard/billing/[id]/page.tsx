import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import { RecordPaymentForm } from "./RecordPaymentForm";
import { CancelInvoiceButton } from "./CancelInvoiceButton";

const STATUS_STYLES: Record<string, string> = {
  UNPAID: "bg-amber-50 text-amber-700",
  PARTIALLY_PAID: "bg-blue-50 text-blue-700",
  PAID: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  let invoice: Invoice;
  try {
    invoice = await apiFetch<Invoice>(`/billing/invoices/${params.id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const remaining = Number(invoice.totalAmount) - Number(invoice.amountPaid);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Invoice #{invoice.invoiceNumber}</h1>
          <p className="text-sm text-slate-500">{invoice.patient.name}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[invoice.status]}`}
        >
          {invoice.status.replace("_", " ")}
        </span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium">Qty</th>
              <th className="pb-2 font-medium">Unit price</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.lineItems.map((item, index) => (
              <tr key={index}>
                <td className="py-2">{item.description}</td>
                <td className="py-2">{item.quantity}</td>
                <td className="py-2">
                  {invoice.currency} {item.unitPrice.toFixed(2)}
                </td>
                <td className="py-2 text-right">
                  {invoice.currency} {(item.quantity * item.unitPrice).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>
              {invoice.currency} {Number(invoice.subtotal).toFixed(2)}
            </span>
          </div>
          {Number(invoice.discountAmount) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span>
                -{invoice.currency} {Number(invoice.discountAmount).toFixed(2)}
              </span>
            </div>
          )}
          {Number(invoice.taxAmount) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span>
                {invoice.currency} {Number(invoice.taxAmount).toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>
              {invoice.currency} {Number(invoice.totalAmount).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Paid</span>
            <span>
              {invoice.currency} {Number(invoice.amountPaid).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <a
            href={`/api/billing/invoices/${invoice.id}/pdf`}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Download PDF
          </a>
          {invoice.status === "UNPAID" && <CancelInvoiceButton invoiceId={invoice.id} />}
        </div>
      </div>

      {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
        <RecordPaymentForm invoiceId={invoice.id} remaining={remaining} currency={invoice.currency} />
      )}

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-medium text-slate-700">
          Payment history
        </div>
        <ul className="divide-y divide-slate-100">
          {(!invoice.payments || invoice.payments.length === 0) && (
            <li className="px-5 py-6 text-center text-sm text-slate-500">No payments recorded yet.</li>
          )}
          {invoice.payments?.map((payment) => (
            <li key={payment.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <span className="font-medium text-slate-900">
                  {invoice.currency} {Number(payment.amount).toFixed(2)}
                </span>
                <span className="text-slate-500"> via {payment.method.replace("_", " ")}</span>
                {payment.reference && <span className="text-slate-400"> ({payment.reference})</span>}
              </div>
              <span className="text-slate-500">{new Date(payment.paidAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

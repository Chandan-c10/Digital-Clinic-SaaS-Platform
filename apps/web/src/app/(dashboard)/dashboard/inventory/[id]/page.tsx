import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { getSession } from "@/lib/session";
import type { InventoryItemDetail } from "@/lib/types";
import { RecordTransactionForm } from "./RecordTransactionForm";

const STOCK_HANDLER_ROLES = ["CLINIC_OWNER", "NURSE", "RECEPTIONIST"];

export default async function InventoryItemPage({ params }: { params: { id: string } }) {
  const session = getSession();
  let item: InventoryItemDetail;
  try {
    item = await apiFetch<InventoryItemDetail>(`/inventory/items/${params.id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const low = item.currentStock <= item.reorderLevel;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{item.name}</h1>
        <p className="text-sm text-slate-500">{item.category ?? "Uncategorized"}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Current stock</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {item.currentStock} <span className="text-base font-normal text-slate-500">{item.unit}</span>
          </p>
          {low && <p className="mt-1 text-xs font-medium text-amber-700">At or below reorder level</p>}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Reorder level</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{item.reorderLevel}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">SKU</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{item.sku ?? "—"}</p>
        </div>
      </div>

      {session?.role && STOCK_HANDLER_ROLES.includes(session.role) && (
        <RecordTransactionForm itemId={item.id} unit={item.unit} />
      )}

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-medium text-slate-700">
          Recent movements
        </div>
        <ul className="divide-y divide-slate-100">
          {item.transactions.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-slate-500">
              No stock movements recorded yet.
            </li>
          )}
          {item.transactions.map((txn) => (
            <li key={txn.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <span className="font-medium text-slate-900">{txn.type}</span>
                <span className={txn.quantity < 0 ? "ml-2 text-red-600" : "ml-2 text-emerald-600"}>
                  {txn.quantity > 0 ? "+" : ""}
                  {txn.quantity}
                </span>
                {txn.reason && <span className="text-slate-500"> — {txn.reason}</span>}
              </div>
              <span className="text-slate-500">{new Date(txn.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

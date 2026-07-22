import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/session";
import type { InventoryItem } from "@/lib/types";
import { NewItemForm } from "./NewItemForm";

export default async function InventoryPage() {
  const session = getSession();
  const items = await apiFetch<InventoryItem[]>("/inventory/items");
  const lowStock = items.filter((item) => item.currentStock <= item.reorderLevel);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Inventory</h1>
          {lowStock.length > 0 && (
            <p className="mt-1 text-sm text-amber-700">
              {lowStock.length} item{lowStock.length === 1 ? "" : "s"} at or below reorder level.
            </p>
          )}
        </div>
        {session?.role === "CLINIC_OWNER" && <NewItemForm />}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Item</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Stock</th>
              <th className="px-5 py-3 font-medium">Reorder level</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-500">
                  No inventory items yet.
                </td>
              </tr>
            )}
            {items.map((item) => {
              const low = item.currentStock <= item.reorderLevel;
              return (
                <tr key={item.id}>
                  <td className="px-5 py-3 font-medium">
                    <Link
                      href={`/dashboard/inventory/${item.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {item.name}
                    </Link>
                    {!item.isActive && <span className="ml-2 text-xs text-slate-500">(inactive)</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{item.category ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {item.currentStock} {item.unit}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{item.reorderLevel}</td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        low
                          ? "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                          : "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                      }
                    >
                      {low ? "Low stock" : "OK"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

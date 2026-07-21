import { apiFetch } from "@/lib/api";

interface NotificationRow {
  id: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP";
  type: string;
  recipient: string;
  status: "PENDING" | "SENT" | "FAILED";
  error?: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  SENT: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700",
  PENDING: "bg-amber-50 text-amber-700",
};

export default async function NotificationsPage() {
  const notifications = await apiFetch<NotificationRow[]>("/notifications");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Notifications log</h1>
        <p className="text-sm text-slate-500">
          Every appointment confirmation, invoice, payment receipt, and prescription-ready
          notification this clinic has attempted to send, and whether it actually went out. SMS and
          WhatsApp will show as failed until a provider is configured (see README).
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Channel</th>
              <th className="px-5 py-3 font-medium">Recipient</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {notifications.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-500">
                  No notifications sent yet.
                </td>
              </tr>
            )}
            {notifications.map((n) => (
              <tr key={n.id}>
                <td className="px-5 py-3 text-slate-900">{n.type.replace(/_/g, " ")}</td>
                <td className="px-5 py-3 text-slate-600">{n.channel}</td>
                <td className="px-5 py-3 text-slate-600">{n.recipient}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[n.status]}`}
                    title={n.error ?? undefined}
                  >
                    {n.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {new Date(n.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

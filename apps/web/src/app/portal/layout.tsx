import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { portalLogoutAction } from "./actions";

const NAV_LINKS = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/appointments", label: "Appointments" },
  { href: "/portal/prescriptions", label: "Prescriptions" },
  { href: "/portal/invoices", label: "Invoices" },
  { href: "/portal/book", label: "Book appointment" },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) {
    redirect("/portal/login");
  }
  if (session.role !== "PATIENT") {
    // A clinic-staff session on the patient portal — not a security hole
    // (every /patient-portal/* API route is @Roles(PATIENT) regardless), but
    // a confusing dead end, so redirect somewhere that account can actually use.
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white px-4 py-6">
        <div className="mb-8 px-2 text-lg font-semibold text-brand-700">Digital Clinic</div>
        <nav className="space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <span className="text-sm text-slate-500">Patient portal</span>
          <form action={portalLogoutAction}>
            <button type="submit" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Log out
            </button>
          </form>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

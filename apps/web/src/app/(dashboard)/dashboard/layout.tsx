import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { logoutAction } from "../../(auth)/actions";

const STAFF_ROLES = ["CLINIC_OWNER", "DOCTOR", "RECEPTIONIST", "NURSE"];
const BILLING_ROLES = ["CLINIC_OWNER", "RECEPTIONIST", "ACCOUNTANT", "DOCTOR"];
const REPORTS_ROLES = ["CLINIC_OWNER", "ACCOUNTANT"];
const ALL_STAFF_ROLES = ["CLINIC_OWNER", "DOCTOR", "RECEPTIONIST", "NURSE", "ACCOUNTANT"];

// Mirrors each API module's @Roles() — kept here only to decide which links
// to show; the API is what actually enforces access (see CLAUDE.md: this
// layer avoids dead-end nav links, it is not the security boundary).
const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/appointments", label: "Appointments", roles: STAFF_ROLES },
  { href: "/dashboard/patients", label: "Patients", roles: STAFF_ROLES },
  { href: "/dashboard/prescriptions", label: "Prescriptions", roles: STAFF_ROLES },
  { href: "/dashboard/billing", label: "Billing", roles: BILLING_ROLES },
  { href: "/dashboard/inventory", label: "Inventory", roles: ALL_STAFF_ROLES },
  { href: "/dashboard/reports", label: "Reports", roles: REPORTS_ROLES },
  { href: "/dashboard/staff", label: "Staff", roles: ["CLINIC_OWNER"] },
  { href: "/dashboard/branches", label: "Branches", roles: ["CLINIC_OWNER"] },
  { href: "/dashboard/notifications", label: "Notifications", roles: ["CLINIC_OWNER"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) {
    redirect("/login");
  }

  const navLinks = NAV_LINKS.filter((link) => !link.roles || link.roles.includes(session.role));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white px-4 py-6">
        <div className="mb-8 px-2 text-lg font-semibold text-brand-700">Digital Clinic</div>
        <nav className="space-y-1">
          {navLinks.map((link) => (
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
          <span className="text-sm text-slate-500">Role: {session.role}</span>
          <form action={logoutAction}>
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

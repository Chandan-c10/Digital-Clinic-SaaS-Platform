import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function PortalLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Patient login</h1>
        <p className="mt-1 text-sm text-slate-500">
          View your appointments, prescriptions, and invoices.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          New here?{" "}
          <Link href="/portal/register" className="font-medium text-brand-600 hover:text-brand-700">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}

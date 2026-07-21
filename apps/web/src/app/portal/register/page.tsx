import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export default function PortalRegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Book appointments and view your records across clinics.
        </p>
        <div className="mt-6">
          <RegisterForm />
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/portal/login" className="font-medium text-brand-600 hover:text-brand-700">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

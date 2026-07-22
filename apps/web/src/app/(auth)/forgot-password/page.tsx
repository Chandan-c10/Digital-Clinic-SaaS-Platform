import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the email on your account and we&rsquo;ll send a link to reset it.
        </p>
        <div className="mt-6">
          <ForgotPasswordForm />
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}

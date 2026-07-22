import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Log in</h1>
        <p className="mt-1 text-sm text-slate-500">Welcome back to your clinic dashboard.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
        <p className="mt-3 text-center text-sm text-slate-500">
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
            Forgot your password?
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-slate-500">
          New here?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
            Start a free trial
          </Link>
        </p>
      </div>
    </main>
  );
}

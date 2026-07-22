import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Set a new password</h1>
        {token ? (
          <div className="mt-6">
            <ResetPasswordForm token={token} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-red-600" role="alert">
            This link is missing its reset token. Request a new one from the{" "}
            <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
              password reset page
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}

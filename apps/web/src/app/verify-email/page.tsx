import { VerifyEmailStatus } from "./VerifyEmailStatus";

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-xl font-semibold text-slate-900">Email verification</h1>
        <div className="mt-4">
          {token ? (
            <VerifyEmailStatus token={token} />
          ) : (
            <p role="alert" className="text-sm text-red-600">
              This link is missing its verification token.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

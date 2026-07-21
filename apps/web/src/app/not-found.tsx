import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="max-w-md text-slate-600">
        The page you&rsquo;re looking for doesn&rsquo;t exist or may have been moved.
      </p>
      <Link
        href="/"
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Back to home
      </Link>
    </main>
  );
}

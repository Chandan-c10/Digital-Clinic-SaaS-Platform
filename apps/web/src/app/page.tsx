import Link from "next/link";

const FEATURES = [
  { title: "Private website", body: "A branded website with your own subdomain or custom domain, live in minutes." },
  { title: "Online booking", body: "Patients book real slots based on your live schedule — no double-booking." },
  { title: "Patient CRM", body: "Medical history, prescriptions, and documents in one secure record per patient." },
  { title: "Clinic ERP", body: "Staff accounts, billing, and reports as your practice grows." },
];

export default function LandingPage() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold text-brand-700">Digital Clinic</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-slate-600 hover:text-slate-900">
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
          >
            Start free trial
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Run your entire clinic from one platform
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          A website, online booking, patient records, and billing — built for doctors and clinics who
          want to go digital without hiring a dev team.
        </p>
        <div className="mt-8">
          <Link
            href="/register"
            className="rounded-md bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
          >
            Start your 14-day free trial
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="rounded-lg border border-slate-200 bg-white p-6">
            <h3 className="font-semibold text-slate-900">{feature.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{feature.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

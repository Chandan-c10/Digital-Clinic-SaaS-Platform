import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicClinicWebsite } from "@/lib/public-api";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const clinic = await getPublicClinicWebsite(params.slug);
  if (!clinic) return {};
  return {
    title: clinic.website?.seoTitle ?? clinic.name,
    description: clinic.website?.seoDescription ?? clinic.website?.aboutText ?? undefined,
  };
}

export default async function ClinicWebsitePage({ params }: Props) {
  const clinic = await getPublicClinicWebsite(params.slug);
  if (!clinic) notFound();

  const { website, profile, doctors } = clinic;
  const primaryColor = website?.primaryColor ?? "#0f766e";

  return (
    <main>
      <header
        className="px-6 py-16 text-center text-white"
        style={{ backgroundColor: primaryColor }}
      >
        {website?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={website.logoUrl} alt={clinic.name} className="mx-auto mb-4 h-16" />
        )}
        <h1 className="text-3xl font-bold">{clinic.name}</h1>
        {profile?.city && (
          <p className="mt-2 text-white/80">
            {profile.city}
            {profile.state ? `, ${profile.state}` : ""}
          </p>
        )}
        <a
          href="#book"
          className="mt-6 inline-block rounded-md bg-white px-6 py-2 font-medium"
          style={{ color: primaryColor }}
        >
          Book an appointment
        </a>
      </header>

      {website?.aboutText && (
        <section className="mx-auto max-w-3xl px-6 py-12 text-center">
          <h2 className="text-xl font-semibold text-slate-900">About</h2>
          <p className="mt-3 text-slate-600">{website.aboutText}</p>
        </section>
      )}

      {doctors.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="text-center text-xl font-semibold text-slate-900">Our Doctors</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((doctor) => (
              <div key={doctor.id} className="rounded-lg border border-slate-200 bg-white p-5 text-center">
                <p className="font-semibold text-slate-900">{doctor.displayName}</p>
                {doctor.specialization && (
                  <p className="mt-1 text-sm text-slate-500">{doctor.specialization}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {website?.servicesJson && website.servicesJson.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="text-center text-xl font-semibold text-slate-900">Services</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {website.servicesJson.map((service) => (
              <div key={service.title} className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="font-semibold text-slate-900">{service.title}</p>
                <p className="mt-1 text-sm text-slate-600">{service.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {website?.testimonialsJson && website.testimonialsJson.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="text-center text-xl font-semibold text-slate-900">What patients say</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {website.testimonialsJson.map((testimonial) => (
              <blockquote key={testimonial.name} className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-slate-600">&ldquo;{testimonial.quote}&rdquo;</p>
                <footer className="mt-2 text-sm font-medium text-slate-900">
                  — {testimonial.name}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {website?.faqJson && website.faqJson.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 py-12">
          <h2 className="text-center text-xl font-semibold text-slate-900">FAQ</h2>
          <div className="mt-6 space-y-4">
            {website.faqJson.map((faq) => (
              <div key={faq.question}>
                <p className="font-medium text-slate-900">{faq.question}</p>
                <p className="mt-1 text-sm text-slate-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="book" className="px-6 py-16 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Ready to book?</h2>
        <p className="mt-2 text-slate-600">
          Contact {profile?.contactEmail ?? clinic.name} to schedule your visit.
        </p>
        {profile?.phone && <p className="mt-1 font-medium text-slate-900">{profile.phone}</p>}
      </section>
    </main>
  );
}

import { API_BASE_URL } from "./constants";

export interface PublicClinicWebsite {
  id: string;
  name: string;
  slug: string;
  profile: {
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    phone?: string | null;
    contactEmail?: string | null;
    consultationFee?: string | null;
    languagesSpoken: string[];
  } | null;
  website: {
    template: string;
    primaryColor: string;
    logoUrl?: string | null;
    heroImageUrl?: string | null;
    aboutText?: string | null;
    servicesJson?: Array<{ title: string; description: string }> | null;
    testimonialsJson?: Array<{ name: string; quote: string; rating?: number }> | null;
    faqJson?: Array<{ question: string; answer: string }> | null;
    galleryUrls: string[];
    googleMapsUrl?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    isPublished: boolean;
  } | null;
  doctors: Array<{ id: string; displayName: string; specialization?: string | null }>;
}

export async function getPublicClinicWebsite(slug: string): Promise<PublicClinicWebsite | null> {
  const res = await fetch(`${API_BASE_URL}/clinics/public/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

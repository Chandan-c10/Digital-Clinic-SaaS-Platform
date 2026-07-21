import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Clinic — Run your entire practice online",
  description:
    "Website, appointments, patient records, and billing for doctors and clinics — all in one platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

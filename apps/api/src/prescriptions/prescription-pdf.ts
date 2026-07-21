import PDFDocument from "pdfkit";
import type { Response } from "express";

interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
}

export interface PrescriptionPdfData {
  patientName: string;
  doctorName: string;
  doctorQualification?: string | null;
  medicines: Medicine[];
  notes?: string | null;
  createdAt: Date;
}

export function streamPrescriptionPdf(res: Response, data: PrescriptionPdfData): void {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="prescription.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).text("Prescription");
  doc.fontSize(10).fillColor("#555555").text(data.createdAt.toDateString());
  doc.fillColor("#000000");
  doc.moveDown();
  doc.fontSize(11).text(`Patient: ${data.patientName}`);
  doc.text(`Doctor: ${data.doctorName}${data.doctorQualification ? ` (${data.doctorQualification})` : ""}`);
  doc.moveDown();

  doc.fontSize(12).text("Medicines", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);
  data.medicines.forEach((medicine, index) => {
    doc.text(
      `${index + 1}. ${medicine.name} — ${medicine.dosage}, ${medicine.frequency}, ${medicine.durationDays} day(s)`,
    );
    if (medicine.instructions) {
      doc.fontSize(9).fillColor("#555555").text(`   ${medicine.instructions}`);
      doc.fontSize(10).fillColor("#000000");
    }
    doc.moveDown(0.3);
  });

  if (data.notes) {
    doc.moveDown();
    doc.fontSize(11).text("Notes", { underline: true });
    doc.fontSize(10).text(data.notes);
  }

  doc.end();
}

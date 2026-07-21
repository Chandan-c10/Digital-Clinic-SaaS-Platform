import PDFDocument from "pdfkit";
import type { Response } from "express";

interface InvoicePdfLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoicePdfData {
  invoiceNumber: number;
  clinicName: string;
  patientName: string;
  lineItems: InvoicePdfLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  status: string;
  createdAt: Date;
}

function money(currency: string, amount: number): string {
  return `${currency} ${amount.toFixed(2)}`;
}

/** Streams a simple invoice PDF directly to the response — no template
 * engine or headless browser, just pdfkit's drawing API, since this needs no
 * styling beyond a readable printed invoice. */
export function streamInvoicePdf(res: Response, invoice: InvoicePdfData): void {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).text(invoice.clinicName);
  doc.moveDown(0.5);
  doc.fontSize(14).text(`Invoice #${invoice.invoiceNumber}`);
  doc.fontSize(10).fillColor("#555555").text(invoice.createdAt.toDateString());
  doc.fillColor("#000000");
  doc.moveDown();
  doc.fontSize(11).text(`Bill to: ${invoice.patientName}`);
  doc.moveDown();

  doc.fontSize(10);
  for (const item of invoice.lineItems) {
    const amount = item.quantity * item.unitPrice;
    doc.text(
      `${item.description}   x${item.quantity}   @ ${money(invoice.currency, item.unitPrice)}   = ${money(invoice.currency, amount)}`,
    );
  }

  doc.moveDown();
  doc.text(`Subtotal: ${money(invoice.currency, invoice.subtotal)}`);
  if (invoice.discountAmount > 0) {
    doc.text(`Discount: -${money(invoice.currency, invoice.discountAmount)}`);
  }
  if (invoice.taxAmount > 0) {
    doc.text(`Tax: ${money(invoice.currency, invoice.taxAmount)}`);
  }
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Total: ${money(invoice.currency, invoice.totalAmount)}`, {
    underline: true,
  });
  doc.fontSize(10).text(`Paid: ${money(invoice.currency, invoice.amountPaid)}`);
  doc.text(`Status: ${invoice.status}`);

  doc.end();
}

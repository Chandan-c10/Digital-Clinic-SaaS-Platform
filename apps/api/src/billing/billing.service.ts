import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, NotificationChannel, NotificationType, Prisma } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";

/** Avoid floating-point drift on money math (e.g. 0.1 + 0.2) before it hits a Decimal column. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const INVOICE_INCLUDE = {
  patient: true,
  clinic: { select: { name: true } },
  payments: { orderBy: { paidAt: "desc" as const } },
};

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(clinicId: string, filters: { patientId?: string; status?: InvoiceStatus }) {
    return this.prisma.invoice.findMany({
      where: { clinicId, ...filters },
      include: { patient: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(clinicId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, clinicId },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    return invoice;
  }

  async create(clinicId: string, createdById: string, dto: CreateInvoiceDto) {
    const patient = await this.prisma.patient.findFirst({ where: { id: dto.patientId, clinicId } });
    if (!patient) throw new NotFoundException("Patient not found");

    // Branch (module Z) is inherited from the appointment, not chosen
    // separately — an invoice for a visit belongs to whichever branch the
    // visit was at. Null (no appointment, or a single-branch clinic) is fine.
    let branchId: string | null = null;
    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findFirst({
        where: { id: dto.appointmentId, clinicId },
      });
      if (!appointment) throw new NotFoundException("Appointment not found");
      branchId = appointment.branchId;
    }

    const subtotal = round2(
      dto.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    );
    const discountAmount = round2(dto.discountAmount ?? 0);
    const taxAmount = round2(dto.taxAmount ?? 0);
    const totalAmount = round2(subtotal - discountAmount + taxAmount);
    if (totalAmount < 0) {
      throw new BadRequestException("Discount cannot exceed subtotal plus tax");
    }

    let invoice;
    try {
      invoice = await this.prisma.$transaction(async (tx) => {
        // Sequential per clinic, not a DB identity column — see the schema
        // comment on Invoice.invoiceNumber. The @@unique([clinicId,
        // invoiceNumber]) constraint is the real safety net under concurrent
        // creates; this count is just the common-case fast path.
        const invoiceCount = await tx.invoice.count({ where: { clinicId } });
        return tx.invoice.create({
          data: {
            clinicId,
            patientId: dto.patientId,
            appointmentId: dto.appointmentId,
            branchId,
            invoiceNumber: invoiceCount + 1,
            lineItems: dto.lineItems,
            subtotal,
            discountAmount,
            taxAmount,
            totalAmount,
            createdById,
            notes: dto.notes,
          },
          include: { patient: true },
        });
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Could not assign an invoice number — please retry");
      }
      throw error;
    }

    void this.notifications.send({
      clinicId,
      channel: NotificationChannel.EMAIL,
      type: NotificationType.INVOICE_CREATED,
      recipient: invoice.patient.email,
      subject: `Invoice #${invoice.invoiceNumber}`,
      body: `A new invoice for ${invoice.currency} ${invoice.totalAmount.toFixed(2)} has been created.`,
    });

    return invoice;
  }

  async recordPayment(
    clinicId: string,
    invoiceId: string,
    recordedById: string,
    dto: RecordPaymentDto,
  ) {
    const invoice = await this.findOne(clinicId, invoiceId);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException("Cannot record a payment against a cancelled invoice");
    }

    const totalAmount = invoice.totalAmount.toNumber();
    const amountPaid = invoice.amountPaid.toNumber();
    const remaining = round2(totalAmount - amountPaid);
    const amount = round2(dto.amount);
    if (amount > remaining) {
      throw new BadRequestException(
        `Payment of ${amount.toFixed(2)} exceeds the remaining balance of ${remaining.toFixed(2)}`,
      );
    }

    const newAmountPaid = round2(amountPaid + amount);
    const newStatus: InvoiceStatus =
      newAmountPaid >= totalAmount ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

    await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          clinicId,
          invoiceId,
          amount,
          method: dto.method,
          reference: dto.reference,
          recordedById,
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { amountPaid: newAmountPaid, status: newStatus },
      }),
    ]);

    const updated = await this.findOne(clinicId, invoiceId);

    void this.notifications.send({
      clinicId,
      channel: NotificationChannel.EMAIL,
      type: NotificationType.PAYMENT_RECEIVED,
      recipient: updated.patient.email,
      subject: `Payment received — Invoice #${updated.invoiceNumber}`,
      body: `We received your payment of ${updated.currency} ${amount.toFixed(2)}. ${
        updated.status === InvoiceStatus.PAID
          ? "This invoice is now fully paid."
          : `Remaining balance: ${updated.currency} ${(totalAmount - newAmountPaid).toFixed(2)}.`
      }`,
    });

    return updated;
  }

  async cancel(clinicId: string, id: string) {
    const invoice = await this.findOne(clinicId, id);
    if (invoice.status !== InvoiceStatus.UNPAID) {
      throw new BadRequestException("Only an unpaid invoice can be cancelled");
    }
    return this.prisma.invoice.update({ where: { id }, data: { status: InvoiceStatus.CANCELLED } });
  }
}

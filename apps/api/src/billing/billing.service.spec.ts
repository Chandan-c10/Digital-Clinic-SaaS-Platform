import { BadRequestException, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, PaymentMethod } from "@digital-clinic/database";
import { BillingService } from "./billing.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";

/** Minimal stand-in for Prisma's Decimal — the service only calls .toNumber()/.toFixed(). */
function decimal(n: number) {
  return { toNumber: () => n, toFixed: (d: number) => n.toFixed(d) } as unknown as number & {
    toNumber(): number;
    toFixed(d: number): string;
  };
}

function makeNotificationsMock() {
  return { send: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService;
}

function makePrismaMock() {
  const tx = {
    invoice: { count: jest.fn(), create: jest.fn() },
  };
  const mock = {
    patient: { findFirst: jest.fn() },
    appointment: { findFirst: jest.fn() },
    invoice: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    payment: { create: jest.fn() },
    $transaction: jest.fn((arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof tx) => unknown)(tx);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
    __tx: tx,
  };
  return mock as unknown as PrismaService & { __tx: typeof tx };
}

describe("BillingService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let notifications: ReturnType<typeof makeNotificationsMock>;
  let service: BillingService;

  const baseDto: CreateInvoiceDto = {
    patientId: "patient-1",
    lineItems: [{ description: "Consultation", quantity: 1, unitPrice: 500 }],
  };

  beforeEach(() => {
    prisma = makePrismaMock();
    notifications = makeNotificationsMock();
    service = new BillingService(prisma, notifications);
  });

  it("refuses to invoice a patient outside the caller's clinic", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.create("clinic-1", "user-1", baseDto)).rejects.toThrow(NotFoundException);
    expect(prisma.patient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "patient-1", clinicId: "clinic-1" } }),
    );
  });

  it("refuses to link an appointment from a different clinic", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "patient-1" });
    (prisma.appointment.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.create("clinic-1", "user-1", { ...baseDto, appointmentId: "appt-from-clinic-2" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("rejects a discount that would make the total negative", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "patient-1" });
    await expect(
      service.create("clinic-1", "user-1", { ...baseDto, discountAmount: 1000 }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("computes totals, assigns the next sequential invoice number, and stamps clinicId", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "patient-1" });
    prisma.__tx.invoice.count.mockResolvedValue(4);
    prisma.__tx.invoice.create.mockResolvedValue({
      id: "new-invoice",
      invoiceNumber: 5,
      currency: "INR",
      totalAmount: decimal(950),
      patient: { email: "patient@example.com" },
    });

    await service.create("clinic-1", "user-1", {
      ...baseDto,
      lineItems: [{ description: "Consultation", quantity: 2, unitPrice: 500 }],
      discountAmount: 100,
      taxAmount: 50,
    });

    expect(prisma.__tx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clinicId: "clinic-1",
          createdById: "user-1",
          invoiceNumber: 5,
          subtotal: 1000,
          discountAmount: 100,
          taxAmount: 50,
          totalAmount: 950,
        }),
      }),
    );
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: "patient@example.com", type: "INVOICE_CREATED" }),
    );
  });

  it("does not let one clinic read another clinic's invoice", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.findOne("clinic-1", "invoice-from-clinic-2")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("refuses a payment that exceeds the remaining balance", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: "invoice-1",
      status: InvoiceStatus.UNPAID,
      totalAmount: decimal(1000),
      amountPaid: decimal(300),
    });
    await expect(
      service.recordPayment("clinic-1", "invoice-1", "user-1", {
        amount: 800,
        method: PaymentMethod.CASH,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("refuses to record a payment against a cancelled invoice", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: "invoice-1",
      status: InvoiceStatus.CANCELLED,
      totalAmount: decimal(1000),
      amountPaid: decimal(0),
    });
    await expect(
      service.recordPayment("clinic-1", "invoice-1", "user-1", {
        amount: 100,
        method: PaymentMethod.CASH,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("marks the invoice PARTIALLY_PAID, then PAID once the balance clears", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: "invoice-1",
      invoiceNumber: 1,
      currency: "INR",
      status: InvoiceStatus.UNPAID,
      totalAmount: decimal(1000),
      amountPaid: decimal(0),
      patient: { email: "patient@example.com" },
    });

    await service.recordPayment("clinic-1", "invoice-1", "user-1", {
      amount: 400,
      method: PaymentMethod.UPI,
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountPaid: 400, status: InvoiceStatus.PARTIALLY_PAID }),
      }),
    );
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "PAYMENT_RECEIVED", recipient: "patient@example.com" }),
    );

    jest.clearAllMocks();
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: "invoice-1",
      invoiceNumber: 1,
      currency: "INR",
      status: InvoiceStatus.PARTIALLY_PAID,
      totalAmount: decimal(1000),
      amountPaid: decimal(400),
      patient: { email: "patient@example.com" },
    });
    await service.recordPayment("clinic-1", "invoice-1", "user-1", {
      amount: 600,
      method: PaymentMethod.UPI,
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountPaid: 1000, status: InvoiceStatus.PAID }),
      }),
    );
  });

  it("only allows cancelling an unpaid invoice", async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: "invoice-1",
      status: InvoiceStatus.PAID,
      totalAmount: decimal(1000),
      amountPaid: decimal(1000),
    });
    await expect(service.cancel("clinic-1", "invoice-1")).rejects.toThrow(BadRequestException);
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });
});

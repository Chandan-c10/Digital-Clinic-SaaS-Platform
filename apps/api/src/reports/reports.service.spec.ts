import { ReportsService } from "./reports.service";
import { PrismaService } from "../prisma/prisma.service";

function decimal(n: number) {
  return { toNumber: () => n } as unknown as number & { toNumber(): number };
}

function makePrismaMock() {
  return {
    payment: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: decimal(0) } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    invoice: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { totalAmount: decimal(0), amountPaid: decimal(0) } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    appointment: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    patient: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    doctorProfile: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;
}

describe("ReportsService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: ReportsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ReportsService(prisma);
  });

  it("scopes every overview query to the caller's clinic", async () => {
    await service.overview("clinic-1", "2026-07-01", "2026-07-31");

    expect(prisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
    expect(prisma.invoice.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
    expect(prisma.appointment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
    expect(prisma.patient.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
  });

  it("computes outstandingAmount as invoiced minus collected, never negative", async () => {
    (prisma.invoice.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalAmount: decimal(1000), amountPaid: decimal(300) },
    });
    const result = await service.overview("clinic-1");
    expect(result.totalInvoiced).toBe(1000);
    expect(result.outstandingAmount).toBe(700);
  });

  it("never reports negative outstanding even if overpaid invoices exist", async () => {
    (prisma.invoice.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalAmount: decimal(500), amountPaid: decimal(500) },
    });
    const result = await service.overview("clinic-1");
    expect(result.outstandingAmount).toBe(0);
  });

  it("scopes revenue() to the caller's clinic and groups payments by day", async () => {
    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      { amount: decimal(200), paidAt: new Date("2026-07-10T09:00:00.000Z") },
      { amount: decimal(300), paidAt: new Date("2026-07-10T14:00:00.000Z") },
      { amount: decimal(150), paidAt: new Date("2026-07-11T09:00:00.000Z") },
    ]);

    const result = await service.revenue("clinic-1", "2026-07-01", "2026-07-31");

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
    expect(result).toEqual([
      { date: "2026-07-10", amount: 500 },
      { date: "2026-07-11", amount: 150 },
    ]);
  });

  it("scopes appointmentTrend() to the caller's clinic and groups by day", async () => {
    (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
      { scheduledAt: new Date("2026-07-10T09:00:00.000Z"), status: "CONFIRMED" },
      { scheduledAt: new Date("2026-07-10T10:00:00.000Z"), status: "COMPLETED" },
    ]);

    const result = await service.appointmentTrend("clinic-1", "2026-07-01", "2026-07-31");

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
    expect(result).toEqual([{ date: "2026-07-10", count: 2 }]);
  });

  it("filters by branch when a branchId is given, via the Invoice relation for payments", async () => {
    await service.overview("clinic-1", "2026-07-01", "2026-07-31", "branch-downtown");

    expect(prisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ invoice: { branchId: "branch-downtown" } }),
      }),
    );
    expect(prisma.invoice.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: "branch-downtown" }) }),
    );
    expect(prisma.appointment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: "branch-downtown" }) }),
    );
    // Patient isn't branch-scoped — the filter must not leak in here.
    expect(prisma.patient.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clinicId: "clinic-1", createdAt: expect.anything() },
      }),
    );
  });

  it("omits the branch filter entirely when no branchId is given", async () => {
    await service.overview("clinic-1", "2026-07-01", "2026-07-31");
    const invoiceCall = (prisma.invoice.aggregate as jest.Mock).mock.calls[0][0];
    expect(invoiceCall.where).not.toHaveProperty("branchId");
  });

  it("doctorPerformance() attributes revenue via the invoice's linked appointment, not by doctor id directly", async () => {
    (prisma.doctorProfile.findMany as jest.Mock).mockResolvedValue([
      { id: "doc-1", displayName: "Dr. Rao" },
      { id: "doc-2", displayName: "Dr. Iyer" },
    ]);
    (prisma.appointment.groupBy as jest.Mock).mockResolvedValue([
      { doctorId: "doc-1", status: "COMPLETED", _count: { _all: 3 } },
      { doctorId: "doc-1", status: "NO_SHOW", _count: { _all: 1 } },
    ]);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([
      { amountPaid: decimal(500), appointment: { doctorId: "doc-1" } },
      { amountPaid: decimal(300), appointment: { doctorId: "doc-1" } },
    ]);

    const result = await service.doctorPerformance("clinic-1", "2026-07-01", "2026-07-31");

    const doc1 = result.find((r) => r.doctorId === "doc-1");
    const doc2 = result.find((r) => r.doctorId === "doc-2");
    expect(doc1).toMatchObject({ totalAppointments: 4, revenue: 800 });
    expect(doc2).toMatchObject({ totalAppointments: 0, revenue: 0 });
  });

  it("popularServices() aggregates invoice line items by description and sorts by revenue desc", async () => {
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([
      { lineItems: [{ description: "Consultation", quantity: 1, unitPrice: 500 }] },
      { lineItems: [{ description: "Consultation", quantity: 1, unitPrice: 500 }] },
      { lineItems: [{ description: "Blood test", quantity: 1, unitPrice: 800 }] },
    ]);

    const result = await service.popularServices("clinic-1", "2026-07-01", "2026-07-31");

    expect(result[0]).toEqual({ description: "Consultation", count: 2, revenue: 1000 });
    expect(result[1]).toEqual({ description: "Blood test", count: 1, revenue: 800 });
  });

  it("patientGrowth() scopes to the caller's clinic and groups new-patient counts by day", async () => {
    (prisma.patient.findMany as jest.Mock).mockResolvedValue([
      { createdAt: new Date("2026-07-10T09:00:00.000Z") },
      { createdAt: new Date("2026-07-10T15:00:00.000Z") },
      { createdAt: new Date("2026-07-12T09:00:00.000Z") },
    ]);

    const result = await service.patientGrowth("clinic-1", "2026-07-01", "2026-07-31");

    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
    expect(result).toEqual([
      { date: "2026-07-10", count: 2 },
      { date: "2026-07-12", count: 1 },
    ]);
  });

  it("patientRetention() reports 0/0/0 with no appointments in range, without querying prior history", async () => {
    (prisma.appointment.findMany as jest.Mock).mockResolvedValueOnce([]);
    const result = await service.patientRetention("clinic-1", "2026-07-01", "2026-07-31");
    expect(result).toMatchObject({ totalPatients: 0, returningPatients: 0, retentionRate: 0 });
    expect(prisma.appointment.findMany).toHaveBeenCalledTimes(1);
  });

  it("patientRetention() splits patients into returning (seen before the window) vs new", async () => {
    (prisma.appointment.findMany as jest.Mock)
      .mockResolvedValueOnce([{ patientId: "p1" }, { patientId: "p2" }]) // seen in range
      .mockResolvedValueOnce([{ patientId: "p1" }]); // seen before range (returning)

    const result = await service.patientRetention("clinic-1", "2026-07-01", "2026-07-31");

    expect(result).toMatchObject({
      totalPatients: 2,
      returningPatients: 1,
      newPatients: 1,
      retentionRate: 0.5,
    });
  });
});

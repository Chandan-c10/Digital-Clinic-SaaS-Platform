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
    },
    appointment: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    patient: {
      count: jest.fn().mockResolvedValue(0),
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
});

import { Injectable } from "@nestjs/common";
import { AppointmentStatus, InvoiceStatus } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_RANGE_DAYS = 30;

function resolveRange(from?: string, to?: string): { start: Date; end: Date } {
  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  return { start, end };
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(clinicId: string, from?: string, to?: string, branchId?: string) {
    const { start, end } = resolveRange(from, to);

    const [revenueAgg, invoicedAgg, appointmentCounts, newPatients] = await Promise.all([
      // Payment has no branchId of its own (see schema) — filtered via its
      // Invoice's branchId instead of denormalizing the column onto Payment.
      this.prisma.payment.aggregate({
        where: { clinicId, paidAt: { gte: start, lte: end }, ...(branchId && { invoice: { branchId } }) },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          clinicId,
          createdAt: { gte: start, lte: end },
          status: { not: InvoiceStatus.CANCELLED },
          ...(branchId && { branchId }),
        },
        _sum: { totalAmount: true, amountPaid: true },
      }),
      this.prisma.appointment.groupBy({
        by: ["status"],
        where: { clinicId, scheduledAt: { gte: start, lte: end }, ...(branchId && { branchId }) },
        _count: { _all: true },
      }),
      // Patient isn't branch-scoped (see schema comment on Branch) — new
      // patient counts are always clinic-wide, regardless of branchId.
      this.prisma.patient.count({
        where: { clinicId, createdAt: { gte: start, lte: end } },
      }),
    ]);

    const totalInvoiced = invoicedAgg._sum.totalAmount?.toNumber() ?? 0;
    const totalCollectedOnInvoiced = invoicedAgg._sum.amountPaid?.toNumber() ?? 0;

    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      totalRevenue: revenueAgg._sum.amount?.toNumber() ?? 0,
      totalInvoiced,
      outstandingAmount: Math.max(0, totalInvoiced - totalCollectedOnInvoiced),
      totalAppointments: appointmentCounts.reduce((sum, row) => sum + row._count._all, 0),
      appointmentsByStatus: Object.fromEntries(
        appointmentCounts.map((row) => [row.status, row._count._all]),
      ) as Record<AppointmentStatus, number>,
      newPatients,
    };
  }

  /**
   * Daily revenue series. Grouped in JS after a single ranged fetch rather
   * than a date-truncating SQL query — Prisma's `groupBy` groups by exact
   * field value, not truncated buckets, and a clinic's payment volume in this
   * phase doesn't warrant raw SQL for it.
   */
  async revenue(clinicId: string, from?: string, to?: string, branchId?: string) {
    const { start, end } = resolveRange(from, to);
    const payments = await this.prisma.payment.findMany({
      where: { clinicId, paidAt: { gte: start, lte: end }, ...(branchId && { invoice: { branchId } }) },
      select: { amount: true, paidAt: true },
    });

    const byDay = new Map<string, number>();
    for (const payment of payments) {
      const key = dayKey(payment.paidAt);
      byDay.set(key, (byDay.get(key) ?? 0) + payment.amount.toNumber());
    }

    return Array.from(byDay.entries())
      .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async appointmentTrend(clinicId: string, from?: string, to?: string, branchId?: string) {
    const { start, end } = resolveRange(from, to);
    const appointments = await this.prisma.appointment.findMany({
      where: { clinicId, scheduledAt: { gte: start, lte: end }, ...(branchId && { branchId }) },
      select: { scheduledAt: true, status: true },
    });

    const byDay = new Map<string, number>();
    for (const appt of appointments) {
      const key = dayKey(appt.scheduledAt);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    return Array.from(byDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

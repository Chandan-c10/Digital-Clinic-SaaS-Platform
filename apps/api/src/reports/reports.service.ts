import { Injectable } from "@nestjs/common";
import { AppointmentStatus, InvoiceStatus } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { resolveRange, dayKey } from "./date-range.util";

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

  // ---------------------------------------------------------------------
  // Advanced analytics (module R, deeper than the four methods above) —
  // kept in this same service/controller rather than a separate module:
  // it's the same domain (reporting over existing data), not a new one.
  // ---------------------------------------------------------------------

  /**
   * Revenue is attributed via `Invoice.amountPaid` on invoices linked to
   * that doctor's appointments (`Invoice.appointmentId` -> `doctorId`),
   * not by re-summing `Payment` (which has no doctor link at all) — a
   * reasonable practical measure for "how much did this doctor generate,"
   * not an audited financial attribution.
   */
  async doctorPerformance(clinicId: string, from?: string, to?: string, branchId?: string) {
    const { start, end } = resolveRange(from, to);

    const [doctors, appointmentCounts, invoices] = await Promise.all([
      this.prisma.doctorProfile.findMany({
        where: { clinicId },
        select: { id: true, displayName: true },
      }),
      this.prisma.appointment.groupBy({
        by: ["doctorId", "status"],
        where: { clinicId, scheduledAt: { gte: start, lte: end }, ...(branchId && { branchId }) },
        _count: { _all: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          clinicId,
          createdAt: { gte: start, lte: end },
          appointmentId: { not: null },
          ...(branchId && { branchId }),
        },
        select: { amountPaid: true, appointment: { select: { doctorId: true } } },
      }),
    ]);

    const revenueByDoctor = new Map<string, number>();
    for (const invoice of invoices) {
      const doctorId = invoice.appointment?.doctorId;
      if (!doctorId) continue;
      revenueByDoctor.set(
        doctorId,
        (revenueByDoctor.get(doctorId) ?? 0) + invoice.amountPaid.toNumber(),
      );
    }

    return doctors.map((doctor) => {
      const counts = appointmentCounts.filter((row) => row.doctorId === doctor.id);
      return {
        doctorId: doctor.id,
        doctorName: doctor.displayName,
        totalAppointments: counts.reduce((sum, row) => sum + row._count._all, 0),
        appointmentsByStatus: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
        revenue: Math.round((revenueByDoctor.get(doctor.id) ?? 0) * 100) / 100,
      };
    });
  }

  /**
   * Aggregates `Invoice.lineItems` (a JSON blob, not a normalized table —
   * see the Billing schema comment) by `description` in JS after a single
   * ranged fetch, same reasoning as revenue()/appointmentTrend() for not
   * reaching for raw SQL at this data volume.
   */
  async popularServices(clinicId: string, from?: string, to?: string, branchId?: string, limit = 10) {
    const { start, end } = resolveRange(from, to);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        clinicId,
        createdAt: { gte: start, lte: end },
        status: { not: InvoiceStatus.CANCELLED },
        ...(branchId && { branchId }),
      },
      select: { lineItems: true },
    });

    const byService = new Map<string, { count: number; revenue: number }>();
    for (const invoice of invoices) {
      const items = invoice.lineItems as Array<{
        description: string;
        quantity: number;
        unitPrice: number;
      }>;
      for (const item of items ?? []) {
        const existing = byService.get(item.description) ?? { count: 0, revenue: 0 };
        existing.count += item.quantity;
        existing.revenue += item.quantity * item.unitPrice;
        byService.set(item.description, existing);
      }
    }

    return Array.from(byService.entries())
      .map(([description, stats]) => ({
        description,
        count: stats.count,
        revenue: Math.round(stats.revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  /** Daily new-patient series — same shape as revenue()/appointmentTrend(),
   * but a time series instead of overview()'s single count. */
  async patientGrowth(clinicId: string, from?: string, to?: string) {
    const { start, end } = resolveRange(from, to);
    const patients = await this.prisma.patient.findMany({
      where: { clinicId, createdAt: { gte: start, lte: end } },
      select: { createdAt: true },
    });

    const byDay = new Map<string, number>();
    for (const patient of patients) {
      const key = dayKey(patient.createdAt);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    return Array.from(byDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * "Returning" = a patient seen in this window who was *also* seen before
   * it started. Not branch-filterable — Patient isn't branch-scoped (same
   * reasoning as overview()'s newPatients), and retention is inherently a
   * whole-clinic behavior question, not a per-location one.
   */
  async patientRetention(clinicId: string, from?: string, to?: string) {
    const { start, end } = resolveRange(from, to);

    const seenInRange = await this.prisma.appointment.findMany({
      where: { clinicId, scheduledAt: { gte: start, lte: end } },
      select: { patientId: true },
      distinct: ["patientId"],
    });
    const patientIds = seenInRange.map((a) => a.patientId);

    if (patientIds.length === 0) {
      return {
        range: { from: start.toISOString(), to: end.toISOString() },
        totalPatients: 0,
        returningPatients: 0,
        newPatients: 0,
        retentionRate: 0,
      };
    }

    const seenBefore = await this.prisma.appointment.findMany({
      where: { clinicId, patientId: { in: patientIds }, scheduledAt: { lt: start } },
      select: { patientId: true },
      distinct: ["patientId"],
    });
    const returningPatients = seenBefore.length;

    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      totalPatients: patientIds.length,
      returningPatients,
      newPatients: patientIds.length - returningPatients,
      retentionRate: Math.round((returningPatients / patientIds.length) * 1000) / 1000,
    };
  }
}

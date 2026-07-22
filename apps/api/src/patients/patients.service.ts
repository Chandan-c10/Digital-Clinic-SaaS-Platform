import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { PageParams } from "../common/pagination.util";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * `includeInactive` defaults to false — soft-deleted patients (see the
   * isActive doc comment on the Patient model) don't clutter the everyday
   * list, but stay reachable via `?includeInactive=true` for anyone who
   * needs to find and restore one.
   *
   * Bounded + counted (QA/security audit, TC-FUNC-01 / TC-PERF-01) — see
   * apps/api/src/common/pagination.util.ts for why the response body stays
   * a plain array (`total` rides on a response header instead).
   */
  async list(clinicId: string, search: string | undefined, includeInactive: boolean, page: PageParams) {
    const where = {
      clinicId,
      ...(includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(clinicId: string, id: string) {
    // Deliberately not filtered by isActive — a soft-deleted patient's own
    // detail page (and the Restore action on it) needs to keep working.
    const patient = await this.prisma.patient.findFirst({
      where: { id, clinicId },
      include: { appointments: true, documents: true, prescriptions: true },
    });
    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
  }

  async create(clinicId: string, dto: CreatePatientDto) {
    return this.prisma.patient.create({ data: { clinicId, ...dto } });
  }

  async update(clinicId: string, id: string, dto: UpdatePatientDto) {
    await this.findOne(clinicId, id);
    return this.prisma.patient.update({ where: { id }, data: dto });
  }

  /**
   * QA/security audit, 2026-07-22 (TC-SEC-01 / TC-DB-01): soft delete, not
   * `prisma.patient.delete()`. The old hard delete cascaded to permanently
   * destroy every linked Appointment/Prescription/Payment/etc. in one
   * irreversible call with nothing logged. Idempotent (no-op, not an error,
   * if already inactive) and logged to AuditLog.
   */
  async remove(clinicId: string, id: string, actorId: string) {
    const patient = await this.findOne(clinicId, id);
    if (!patient.isActive) return patient;

    const updated = await this.prisma.patient.update({
      where: { id },
      data: { isActive: false },
    });
    await this.auditLog.record({
      clinicId,
      actorId,
      action: "PATIENT_SOFT_DELETED",
      entityType: "Patient",
      entityId: id,
    });
    return updated;
  }

  async restore(clinicId: string, id: string, actorId: string) {
    const patient = await this.findOne(clinicId, id);
    if (patient.isActive) return patient;

    const updated = await this.prisma.patient.update({
      where: { id },
      data: { isActive: true },
    });
    await this.auditLog.record({
      clinicId,
      actorId,
      action: "PATIENT_RESTORED",
      entityType: "Patient",
      entityId: id,
    });
    return updated;
  }
}

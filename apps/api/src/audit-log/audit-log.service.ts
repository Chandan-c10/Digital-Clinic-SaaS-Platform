import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface RecordParams {
  clinicId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/**
 * General-purpose audit trail (QA/security audit, 2026-07-22 — TC-SEC-01 /
 * TC-DB-04). Only Patient soft-delete/restore calls this today — see the
 * doc comment on the AuditLog model for why that's a deliberate starting
 * point, not the full scope.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  record(params: RecordParams) {
    return this.prisma.auditLog.create({ data: params });
  }

  list(clinicId: string) {
    return this.prisma.auditLog.findMany({
      where: { clinicId },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}

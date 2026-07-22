import { AuditLogService } from "./audit-log.service";
import { PrismaService } from "../prisma/prisma.service";

function makePrismaMock() {
  return {
    auditLog: { create: jest.fn(), findMany: jest.fn() },
  } as unknown as PrismaService;
}

describe("AuditLogService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: AuditLogService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AuditLogService(prisma);
  });

  it("records an entry with the given clinic/actor/entity", async () => {
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: "log-1" });
    await service.record({
      clinicId: "clinic-1",
      actorId: "user-1",
      action: "PATIENT_SOFT_DELETED",
      entityType: "Patient",
      entityId: "patient-1",
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        clinicId: "clinic-1",
        actorId: "user-1",
        action: "PATIENT_SOFT_DELETED",
        entityType: "Patient",
        entityId: "patient-1",
      },
    });
  });

  it("scopes list() to the caller's clinic", async () => {
    (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
    await service.list("clinic-1");
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clinicId: "clinic-1" } }),
    );
  });
});

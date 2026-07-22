import { NotFoundException } from "@nestjs/common";
import { PatientsService } from "./patients.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";

function makePrismaMock() {
  return {
    patient: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
}

function makeAuditLogMock() {
  return { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogService;
}

describe("PatientsService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let auditLog: ReturnType<typeof makeAuditLogMock>;
  let service: PatientsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    auditLog = makeAuditLogMock();
    service = new PatientsService(prisma, auditLog);
  });

  it("scopes list() to the caller's clinic", async () => {
    (prisma.patient.findMany as jest.Mock).mockResolvedValue([]);
    await service.list("clinic-1");
    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
  });

  it("list() excludes soft-deleted patients by default", async () => {
    (prisma.patient.findMany as jest.Mock).mockResolvedValue([]);
    await service.list("clinic-1");
    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    );
  });

  it("list() includes soft-deleted patients when includeInactive is true", async () => {
    (prisma.patient.findMany as jest.Mock).mockResolvedValue([]);
    await service.list("clinic-1", undefined, true);
    const where = (prisma.patient.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.isActive).toBeUndefined();
  });

  it("does not let one clinic read another clinic's patient by id", async () => {
    // A patient row with this id exists, but for a different clinic — the
    // findFirst call is scoped by clinicId, so Prisma itself returns null.
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.findOne("clinic-1", "patient-from-clinic-2")).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.patient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "patient-from-clinic-2", clinicId: "clinic-1" } }),
    );
  });

  it("stamps create() with the caller's clinicId", async () => {
    (prisma.patient.create as jest.Mock).mockResolvedValue({ id: "p1" });
    const dto = { name: "Ramesh Kumar" } as CreatePatientDto;
    await service.create("clinic-1", dto);
    expect(prisma.patient.create).toHaveBeenCalledWith({
      data: { clinicId: "clinic-1", name: "Ramesh Kumar" },
    });
  });

  it("refuses to update a patient outside the caller's clinic", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue(null);
    const dto = { name: "New name" } as UpdatePatientDto;
    await expect(service.update("clinic-1", "patient-from-clinic-2", dto)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.patient.update).not.toHaveBeenCalled();
  });

  it("refuses to soft-delete a patient outside the caller's clinic", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.remove("clinic-1", "patient-from-clinic-2", "user-1")).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.patient.update).not.toHaveBeenCalled();
  });

  it("remove() flips isActive to false and logs it, instead of deleting the row", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "p1", isActive: true });
    (prisma.patient.update as jest.Mock).mockResolvedValue({ id: "p1", isActive: false });

    await service.remove("clinic-1", "p1", "user-1");

    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { isActive: false },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: "clinic-1",
        actorId: "user-1",
        action: "PATIENT_SOFT_DELETED",
        entityType: "Patient",
        entityId: "p1",
      }),
    );
  });

  it("remove() is idempotent — a no-op, not an error, on an already-inactive patient", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "p1", isActive: false });
    await service.remove("clinic-1", "p1", "user-1");
    expect(prisma.patient.update).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it("restore() flips isActive back to true and logs it", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue({ id: "p1", isActive: false });
    (prisma.patient.update as jest.Mock).mockResolvedValue({ id: "p1", isActive: true });

    await service.restore("clinic-1", "p1", "user-1");

    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { isActive: true },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PATIENT_RESTORED", entityId: "p1" }),
    );
  });
});

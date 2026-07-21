import { NotFoundException } from "@nestjs/common";
import { PatientsService } from "./patients.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";

function makePrismaMock() {
  return {
    patient: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as PrismaService;
}

describe("PatientsService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: PatientsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new PatientsService(prisma);
  });

  it("scopes list() to the caller's clinic", async () => {
    (prisma.patient.findMany as jest.Mock).mockResolvedValue([]);
    await service.list("clinic-1");
    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
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

  it("refuses to delete a patient outside the caller's clinic", async () => {
    (prisma.patient.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.remove("clinic-1", "patient-from-clinic-2")).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.patient.delete).not.toHaveBeenCalled();
  });
});

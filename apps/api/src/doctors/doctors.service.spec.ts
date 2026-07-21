import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { DoctorsService } from "./doctors.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDoctorDto } from "./dto/create-doctor.dto";

function makePrismaMock() {
  const tx = {
    user: { create: jest.fn() },
    doctorProfile: { create: jest.fn() },
    doctorAvailability: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
  };
  return {
    user: { findUnique: jest.fn() },
    doctorProfile: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    branch: { findMany: jest.fn() },
    $transaction: jest.fn((cb: (tx: typeof tx) => unknown) => cb(tx)),
    __tx: tx,
  } as unknown as PrismaService & { __tx: typeof tx };
}

describe("DoctorsService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: DoctorsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new DoctorsService(prisma);
  });

  it("scopes list() to the caller's clinic", async () => {
    (prisma.doctorProfile.findMany as jest.Mock).mockResolvedValue([]);
    await service.list("clinic-1");
    expect(prisma.doctorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clinicId: "clinic-1" } }),
    );
  });

  it("refuses to read a doctor outside the caller's clinic", async () => {
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.findOne("clinic-1", "doc-from-clinic-2")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("rejects creating a doctor whose email is already registered (any clinic)", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "existing-user" });
    const dto = {
      email: "dupe@example.com",
      password: "password123",
      displayName: "Dr. X",
    } as CreateDoctorDto;
    await expect(service.create("clinic-1", dto)).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("stamps the new doctor's User and DoctorProfile with the caller's clinicId", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    prisma.__tx.user.create.mockResolvedValue({ id: "new-user" });
    prisma.__tx.doctorProfile.create.mockResolvedValue({ id: "new-doctor" });

    const dto = {
      email: "dr.new@example.com",
      password: "password123",
      displayName: "Dr. New",
    } as CreateDoctorDto;
    await service.create("clinic-1", dto);

    expect(prisma.__tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
    expect(prisma.__tx.doctorProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clinicId: "clinic-1", userId: "new-user" }),
      }),
    );
  });

  it("refuses to set availability for a doctor outside the caller's clinic", async () => {
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.setAvailability("clinic-1", "doc-from-clinic-2", {
        slots: [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00", slotDurationMinutes: 15 }],
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.__tx.doctorAvailability.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses availability slots naming a branch from a different clinic", async () => {
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue({ id: "doctor-1" });
    (prisma.branch.findMany as jest.Mock).mockResolvedValue([]); // none matched clinic-1
    await expect(
      service.setAvailability("clinic-1", "doctor-1", {
        slots: [
          {
            dayOfWeek: 1,
            startTime: "09:00",
            endTime: "12:00",
            slotDurationMinutes: 15,
            branchId: "branch-from-clinic-2",
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.__tx.doctorAvailability.deleteMany).not.toHaveBeenCalled();
  });

  it("accepts availability slots naming a branch that belongs to the caller's clinic", async () => {
    (prisma.doctorProfile.findFirst as jest.Mock).mockResolvedValue({ id: "doctor-1" });
    (prisma.branch.findMany as jest.Mock).mockResolvedValue([{ id: "branch-1" }]);
    prisma.__tx.doctorAvailability.findMany.mockResolvedValue([]);

    await service.setAvailability("clinic-1", "doctor-1", {
      slots: [
        {
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "12:00",
          slotDurationMinutes: 15,
          branchId: "branch-1",
        },
      ],
    });

    expect(prisma.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["branch-1"] }, clinicId: "clinic-1" } }),
    );
    expect(prisma.__tx.doctorAvailability.deleteMany).toHaveBeenCalled();
  });
});

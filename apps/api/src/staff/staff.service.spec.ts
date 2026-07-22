import { ConflictException, NotFoundException } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { StaffService } from "./staff.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStaffDto } from "./dto/create-staff.dto";

function makePrismaMock() {
  return {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: { updateMany: jest.fn() },
    loginEvent: { findMany: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
}

describe("StaffService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: StaffService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new StaffService(prisma);
  });

  it("scopes list() to the caller's clinic and to manageable staff roles only", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    await service.list("clinic-1");
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clinicId: "clinic-1",
          role: { in: [Role.RECEPTIONIST, Role.NURSE, Role.ACCOUNTANT] },
        },
      }),
    );
  });

  it("refuses to manage a staff account from a different clinic", async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.findOne("clinic-1", "staff-from-clinic-2")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("excludes CLINIC_OWNER/DOCTOR accounts from this service even within the same clinic", async () => {
    // The role filter is part of the query itself, so even a matching
    // clinicId won't return an owner/doctor row — Prisma returns null.
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.findOne("clinic-1", "the-owner-user-id")).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "the-owner-user-id",
          clinicId: "clinic-1",
          role: { in: [Role.RECEPTIONIST, Role.NURSE, Role.ACCOUNTANT] },
        },
      }),
    );
  });

  it("rejects creating staff with an email already registered", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "existing" });
    const dto = {
      name: "Dupe",
      email: "dupe@example.com",
      password: "password123",
      role: Role.RECEPTIONIST,
    } as CreateStaffDto;
    await expect(service.create("clinic-1", dto)).rejects.toThrow(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("stamps a new staff account with the caller's clinicId", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: "new-staff" });
    const dto = {
      name: "New Staff",
      email: "new@example.com",
      password: "password123",
      role: Role.NURSE,
    } as CreateStaffDto;
    await service.create("clinic-1", dto);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clinicId: "clinic-1", role: Role.NURSE }),
      }),
    );
  });

  it("marks a staff account pre-verified — the owner vouches for the email, unlike self-registration", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: "new-staff" });
    const dto = {
      name: "New Staff",
      email: "new@example.com",
      password: "password123",
      role: Role.NURSE,
    } as CreateStaffDto;
    await service.create("clinic-1", dto);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isEmailVerified: true }) }),
    );
  });

  it("revokes live sessions when deactivating, but not when reactivating", async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: "staff-1" });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: "staff-1", isActive: false });

    await service.setStatus("clinic-1", "staff-1", false);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "staff-1", revokedAt: null } }),
    );

    jest.clearAllMocks();
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: "staff-1" });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: "staff-1", isActive: true });

    await service.setStatus("clinic-1", "staff-1", true);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

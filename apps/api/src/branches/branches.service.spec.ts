import { NotFoundException } from "@nestjs/common";
import { BranchesService } from "./branches.service";
import { PrismaService } from "../prisma/prisma.service";

function makePrismaMock() {
  return {
    branch: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
}

describe("BranchesService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: BranchesService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new BranchesService(prisma);
  });

  it("scopes list() to the caller's clinic", async () => {
    (prisma.branch.findMany as jest.Mock).mockResolvedValue([]);
    await service.list("clinic-1");
    expect(prisma.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clinicId: "clinic-1" } }),
    );
  });

  it("does not let one clinic read another clinic's branch", async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.findOne("clinic-1", "branch-from-clinic-2")).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.branch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "branch-from-clinic-2", clinicId: "clinic-1" } }),
    );
  });

  it("stamps create() with the caller's clinicId", async () => {
    (prisma.branch.create as jest.Mock).mockResolvedValue({ id: "b1" });
    await service.create("clinic-1", { name: "Downtown" });
    expect(prisma.branch.create).toHaveBeenCalledWith({
      data: { clinicId: "clinic-1", name: "Downtown" },
    });
  });

  it("refuses to update a branch outside the caller's clinic", async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.update("clinic-1", "branch-from-clinic-2", { name: "New name" }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.branch.update).not.toHaveBeenCalled();
  });

  it("refuses to deactivate a branch outside the caller's clinic", async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.setStatus("clinic-1", "branch-from-clinic-2", false)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.branch.update).not.toHaveBeenCalled();
  });
});

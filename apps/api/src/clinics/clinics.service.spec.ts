import { NotFoundException } from "@nestjs/common";
import { ClinicsService } from "./clinics.service";
import { PrismaService } from "../prisma/prisma.service";

function makePrismaMock() {
  return {
    clinic: { findUnique: jest.fn() },
    clinicProfile: { upsert: jest.fn() },
    clinicWebsite: { upsert: jest.fn() },
  } as unknown as PrismaService;
}

describe("ClinicsService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: ClinicsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ClinicsService(prisma);
  });

  it("throws if the caller's own clinicId doesn't resolve to a clinic", async () => {
    (prisma.clinic.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.getOwnClinic("clinic-1")).rejects.toThrow(NotFoundException);
  });

  it("scopes profile updates to the caller's clinic", async () => {
    (prisma.clinicProfile.upsert as jest.Mock).mockResolvedValue({});
    await service.updateProfile("clinic-1", { city: "Bengaluru" });
    expect(prisma.clinicProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clinicId: "clinic-1" } }),
    );
  });

  it("scopes website updates to the caller's clinic", async () => {
    (prisma.clinicWebsite.upsert as jest.Mock).mockResolvedValue({});
    await service.updateWebsite("clinic-1", { isPublished: true });
    expect(prisma.clinicWebsite.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clinicId: "clinic-1" } }),
    );
  });

  it("hides an unpublished website from the public endpoint", async () => {
    (prisma.clinic.findUnique as jest.Mock).mockResolvedValue({
      slug: "sunrise",
      website: { isPublished: false },
    });
    await expect(service.getPublishedWebsiteBySlug("sunrise")).rejects.toThrow(NotFoundException);
  });

  it("404s a slug that doesn't exist at all, not just an unpublished one", async () => {
    (prisma.clinic.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.getPublishedWebsiteBySlug("nonexistent")).rejects.toThrow(
      NotFoundException,
    );
  });
});

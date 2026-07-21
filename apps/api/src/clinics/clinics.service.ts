import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateClinicProfileDto } from "./dto/update-clinic-profile.dto";
import { UpdateClinicWebsiteDto } from "./dto/update-clinic-website.dto";

@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnClinic(clinicId: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      include: { profile: true, website: true },
    });
    if (!clinic) throw new NotFoundException("Clinic not found");
    return clinic;
  }

  async updateProfile(clinicId: string, dto: UpdateClinicProfileDto) {
    return this.prisma.clinicProfile.upsert({
      where: { clinicId },
      update: dto,
      create: { clinicId, ...dto },
    });
  }

  async updateWebsite(clinicId: string, dto: UpdateClinicWebsiteDto) {
    return this.prisma.clinicWebsite.upsert({
      where: { clinicId },
      update: dto,
      create: { clinicId, ...dto },
    });
  }

  /** Public, unauthenticated read for the clinic's marketing website. */
  async getPublishedWebsiteBySlug(slug: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { slug },
      include: { profile: true, website: true, doctors: { include: { availabilities: true } } },
    });
    if (!clinic || !clinic.website?.isPublished) {
      throw new NotFoundException("Clinic website not found");
    }
    return clinic;
  }
}

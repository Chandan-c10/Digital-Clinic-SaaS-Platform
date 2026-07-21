import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password.util";
import { CreateDoctorDto } from "./dto/create-doctor.dto";
import { UpdateDoctorDto } from "./dto/update-doctor.dto";
import { SetAvailabilityDto } from "./dto/set-availability.dto";

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(clinicId: string) {
    return this.prisma.doctorProfile.findMany({
      where: { clinicId },
      include: { availabilities: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async findOne(clinicId: string, id: string) {
    const doctor = await this.prisma.doctorProfile.findFirst({
      where: { id, clinicId },
      include: { availabilities: true },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");
    return doctor;
  }

  async create(clinicId: string, dto: CreateDoctorDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email already registered");

    const { email, password, ...profileFields } = dto;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.displayName,
          email,
          passwordHash: hashPassword(password),
          role: Role.DOCTOR,
          clinicId,
          isEmailVerified: false,
        },
      });

      return tx.doctorProfile.create({
        data: { clinicId, userId: user.id, ...profileFields },
      });
    });
  }

  async update(clinicId: string, id: string, dto: UpdateDoctorDto) {
    await this.findOne(clinicId, id);
    return this.prisma.doctorProfile.update({ where: { id }, data: dto });
  }

  async setAvailability(clinicId: string, doctorId: string, dto: SetAvailabilityDto) {
    await this.findOne(clinicId, doctorId);

    const branchIds = [...new Set(dto.slots.map((s) => s.branchId).filter((id): id is string => !!id))];
    if (branchIds.length > 0) {
      const branches = await this.prisma.branch.findMany({
        where: { id: { in: branchIds }, clinicId },
        select: { id: true },
      });
      if (branches.length !== branchIds.length) {
        throw new BadRequestException("One or more branches don't belong to this clinic");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.doctorAvailability.deleteMany({ where: { doctorId } });
      await tx.doctorAvailability.createMany({
        data: dto.slots.map((slot) => ({ doctorId, ...slot })),
      });
      return tx.doctorAvailability.findMany({ where: { doctorId } });
    });
  }
}

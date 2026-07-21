import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(clinicId: string, search?: string) {
    return this.prisma.patient.findMany({
      where: {
        clinicId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(clinicId: string, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, clinicId },
      include: { appointments: true, documents: true, prescriptions: true },
    });
    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
  }

  async create(clinicId: string, dto: CreatePatientDto) {
    return this.prisma.patient.create({ data: { clinicId, ...dto } });
  }

  async update(clinicId: string, id: string, dto: UpdatePatientDto) {
    await this.findOne(clinicId, id);
    return this.prisma.patient.update({ where: { id }, data: dto });
  }

  async remove(clinicId: string, id: string) {
    await this.findOne(clinicId, id);
    await this.prisma.patient.delete({ where: { id } });
  }
}

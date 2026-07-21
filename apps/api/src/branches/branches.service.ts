import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  list(clinicId: string) {
    return this.prisma.branch.findMany({
      where: { clinicId },
      orderBy: { createdAt: "asc" },
    });
  }

  async findOne(clinicId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, clinicId } });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  create(clinicId: string, dto: CreateBranchDto) {
    return this.prisma.branch.create({ data: { clinicId, ...dto } });
  }

  async update(clinicId: string, id: string, dto: UpdateBranchDto) {
    await this.findOne(clinicId, id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  /**
   * Soft-disable only, like Staff deactivation — no hard delete. A Branch
   * being deactivated doesn't invalidate existing appointments/invoices/
   * prescriptions/staff still pointing at it; deactivating just stops it
   * being offered for new availability/bookings (enforced by the modules
   * that read Branch.isActive when listing options, not by this method).
   */
  async setStatus(clinicId: string, id: string, isActive: boolean) {
    await this.findOne(clinicId, id);
    return this.prisma.branch.update({ where: { id }, data: { isActive } });
  }
}

import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password.util";
import { STAFF_MANAGEABLE_ROLES } from "./staff-roles";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";

const PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  isEmailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  list(clinicId: string) {
    return this.prisma.user.findMany({
      where: { clinicId, role: { in: STAFF_MANAGEABLE_ROLES } },
      select: PUBLIC_SELECT,
      orderBy: { createdAt: "asc" },
    });
  }

  async findOne(clinicId: string, id: string) {
    const staff = await this.prisma.user.findFirst({
      where: { id, clinicId, role: { in: STAFF_MANAGEABLE_ROLES } },
      select: PUBLIC_SELECT,
    });
    if (!staff) throw new NotFoundException("Staff member not found");
    return staff;
  }

  async create(clinicId: string, dto: CreateStaffDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email already registered");

    return this.prisma.user.create({
      data: {
        clinicId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        role: dto.role,
        passwordHash: hashPassword(dto.password),
        isEmailVerified: false,
      },
      select: PUBLIC_SELECT,
    });
  }

  async update(clinicId: string, id: string, dto: UpdateStaffDto) {
    await this.findOne(clinicId, id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: PUBLIC_SELECT,
    });
  }

  /**
   * Deactivating blocks future logins and token refreshes (see
   * auth.service.ts) and immediately revokes any sessions the account
   * currently holds — deactivation should end access right away, not
   * whenever their access token happens to expire.
   */
  async setStatus(clinicId: string, id: string, isActive: boolean) {
    await this.findOne(clinicId, id);
    if (isActive) {
      return this.prisma.user.update({ where: { id }, data: { isActive }, select: PUBLIC_SELECT });
    }
    const [staff] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { isActive }, select: PUBLIC_SELECT }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return staff;
  }

  async activity(clinicId: string, id: string) {
    await this.findOne(clinicId, id);
    return this.prisma.loginEvent.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}

import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { PharmacyService } from "./pharmacy.service";
import { DispensePrescriptionDto } from "./dto/dispense-prescription.dto";

const READ_ROLES = [Role.CLINIC_OWNER, Role.DOCTOR, Role.NURSE, Role.RECEPTIONIST];
const DISPENSE_ROLES = [Role.CLINIC_OWNER, Role.NURSE, Role.RECEPTIONIST];

@Controller("pharmacy")
@UseGuards(TenantGuard)
@Roles(...READ_ROLES)
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Get("prescriptions/pending")
  listPending(@CurrentUser() user: RequestUser) {
    return this.pharmacyService.listPending(user.clinicId!);
  }

  @Get("prescriptions/:id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.pharmacyService.findOne(user.clinicId!, id);
  }

  @Post("prescriptions/:id/dispense")
  @Roles(...DISPENSE_ROLES)
  dispense(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: DispensePrescriptionDto,
  ) {
    return this.pharmacyService.dispense(user.clinicId!, id, user.userId, dto);
  }
}

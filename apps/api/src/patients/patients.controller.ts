import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { PatientsService } from "./patients.service";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";

const STAFF_ROLES = [Role.CLINIC_OWNER, Role.DOCTOR, Role.RECEPTIONIST, Role.NURSE];
// ACCOUNTANT gets read-only access — billing needs to look up a patient to
// invoice them, but accountants shouldn't edit medical/demographic records.
const READ_ROLES = [...STAFF_ROLES, Role.ACCOUNTANT];

@Controller("patients")
@UseGuards(TenantGuard)
@Roles(...STAFF_ROLES)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @Roles(...READ_ROLES)
  list(@CurrentUser() user: RequestUser, @Query("search") search?: string) {
    return this.patientsService.list(user.clinicId!, search);
  }

  @Get(":id")
  @Roles(...READ_ROLES)
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.patientsService.findOne(user.clinicId!, id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePatientDto) {
    return this.patientsService.create(user.clinicId!, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(user.clinicId!, id, dto);
  }

  @Delete(":id")
  @Roles(Role.CLINIC_OWNER)
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.patientsService.remove(user.clinicId!, id);
  }
}

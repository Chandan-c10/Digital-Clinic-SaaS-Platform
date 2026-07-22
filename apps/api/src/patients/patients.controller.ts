import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { parsePageParams } from "../common/pagination.util";
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
  async list(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
    @Query("search") search?: string,
    @Query("includeInactive") includeInactive?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const { data, total } = await this.patientsService.list(
      user.clinicId!,
      search,
      includeInactive === "true",
      parsePageParams(page, pageSize),
    );
    res.setHeader("X-Total-Count", String(total));
    return data;
  }

  @Get(":id")
  @Roles(...READ_ROLES)
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.patientsService.findOne(user.clinicId!, id);
  }

  // QA/security audit, TC-SEC-08: tighter than the 100/min global default —
  // patient creation is exactly the kind of write-heavy, enumerable-ish
  // route the finding called out as unprotected beyond the general bucket.
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePatientDto) {
    return this.patientsService.create(user.clinicId!, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(user.clinicId!, id, dto);
  }

  // Soft delete (QA/security audit, TC-SEC-01 / TC-DB-01) — see the
  // isActive doc comment on the Patient model. Kept at DELETE :id (not
  // renamed to a /status-style PATCH like Staff/Branches) since this is
  // still the endpoint a client expects "remove this patient" to be.
  @Delete(":id")
  @Roles(Role.CLINIC_OWNER)
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.patientsService.remove(user.clinicId!, id, user.userId);
  }

  @Patch(":id/restore")
  @Roles(Role.CLINIC_OWNER)
  restore(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.patientsService.restore(user.clinicId!, id, user.userId);
  }
}

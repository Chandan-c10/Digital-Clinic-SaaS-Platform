import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { PrescriptionsService } from "./prescriptions.service";
import { CreatePrescriptionDto } from "./dto/create-prescription.dto";
import { streamPrescriptionPdf } from "./prescription-pdf";

const READ_ROLES = [Role.CLINIC_OWNER, Role.DOCTOR, Role.RECEPTIONIST, Role.NURSE];

@Controller("prescriptions")
@UseGuards(TenantGuard)
@Roles(...READ_ROLES)
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("patientId") patientId?: string) {
    return this.prescriptionsService.list(user.clinicId!, { patientId });
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.prescriptionsService.findOne(user.clinicId!, id);
  }

  @Get(":id/pdf")
  async downloadPdf(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const prescription = await this.prescriptionsService.findOne(user.clinicId!, id);
    streamPrescriptionPdf(res, {
      patientName: prescription.patient.name,
      doctorName: prescription.doctor.displayName,
      doctorQualification: prescription.doctor.qualification,
      medicines: prescription.medicines as Array<{
        name: string;
        dosage: string;
        frequency: string;
        durationDays: number;
        instructions?: string;
      }>,
      notes: prescription.notes,
      createdAt: prescription.createdAt,
    });
  }

  @Post()
  @Roles(Role.DOCTOR)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePrescriptionDto) {
    return this.prescriptionsService.create(user.clinicId!, user.userId, dto);
  }
}

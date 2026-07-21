import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AppointmentStatus, Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { AppointmentsService } from "./appointments.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentStatusDto } from "./dto/update-appointment-status.dto";
import { RescheduleAppointmentDto } from "./dto/reschedule-appointment.dto";
import { AvailableSlotsQueryDto } from "./dto/available-slots-query.dto";

const STAFF_ROLES = [Role.CLINIC_OWNER, Role.DOCTOR, Role.RECEPTIONIST, Role.NURSE];

@Controller("appointments")
@UseGuards(TenantGuard)
@Roles(...STAFF_ROLES)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get("available-slots")
  getAvailableSlots(@CurrentUser() user: RequestUser, @Query() query: AvailableSlotsQueryDto) {
    return this.appointmentsService.getAvailableSlots(user.clinicId!, query);
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query("doctorId") doctorId?: string,
    @Query("patientId") patientId?: string,
    @Query("status") status?: AppointmentStatus,
  ) {
    return this.appointmentsService.list(user.clinicId!, { doctorId, patientId, status });
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(user.clinicId!, dto);
  }

  @Patch(":id/status")
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentsService.updateStatus(user.clinicId!, id, dto);
  }

  @Patch(":id/reschedule")
  reschedule(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentsService.reschedule(user.clinicId!, id, dto);
  }
}

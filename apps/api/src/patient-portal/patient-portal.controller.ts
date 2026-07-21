import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { PatientPortalService } from "./patient-portal.service";
import { PortalBookAppointmentDto } from "./dto/book-appointment.dto";
import { PortalAvailableSlotsQueryDto } from "./dto/available-slots-query.dto";

/**
 * Identity-scoped, not clinic-scoped — every other controller in this app
 * adds `@UseGuards(TenantGuard)` to resolve a clinicId; this one doesn't,
 * because there isn't one to resolve (see the class comment on
 * PatientPortalService). Authentication and the PATIENT role check are
 * still enforced, by the same global JwtAuthGuard + RolesGuard every route
 * gets (app.module.ts) — `@Roles(Role.PATIENT)` is what does the work here.
 */
@Controller("patient-portal")
@Roles(Role.PATIENT)
export class PatientPortalController {
  constructor(private readonly patientPortalService: PatientPortalService) {}

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.patientPortalService.me(user.userId);
  }

  @Get("appointments")
  myAppointments(@CurrentUser() user: RequestUser) {
    return this.patientPortalService.myAppointments(user.userId);
  }

  @Get("prescriptions")
  myPrescriptions(@CurrentUser() user: RequestUser) {
    return this.patientPortalService.myPrescriptions(user.userId);
  }

  @Get("invoices")
  myInvoices(@CurrentUser() user: RequestUser) {
    return this.patientPortalService.myInvoices(user.userId);
  }

  @Get("clinics")
  listClinics() {
    return this.patientPortalService.listClinics();
  }

  @Get("clinics/:clinicId/doctors")
  listDoctors(@Param("clinicId") clinicId: string) {
    return this.patientPortalService.listDoctors(clinicId);
  }

  @Get("available-slots")
  availableSlots(@Query() query: PortalAvailableSlotsQueryDto) {
    return this.patientPortalService.availableSlots(query);
  }

  @Post("appointments")
  bookAppointment(@CurrentUser() user: RequestUser, @Body() dto: PortalBookAppointmentDto) {
    return this.patientPortalService.bookAppointment(user.userId, dto);
  }
}

import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UseGuards(TenantGuard)
@Roles(Role.CLINIC_OWNER, Role.ACCOUNTANT)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("overview")
  overview(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.reportsService.overview(user.clinicId!, from, to, branchId);
  }

  @Get("revenue")
  revenue(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.reportsService.revenue(user.clinicId!, from, to, branchId);
  }

  @Get("appointments")
  appointmentTrend(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.reportsService.appointmentTrend(user.clinicId!, from, to, branchId);
  }

  @Get("doctor-performance")
  doctorPerformance(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.reportsService.doctorPerformance(user.clinicId!, from, to, branchId);
  }

  @Get("popular-services")
  popularServices(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("branchId") branchId?: string,
  ) {
    return this.reportsService.popularServices(user.clinicId!, from, to, branchId);
  }

  @Get("patient-growth")
  patientGrowth(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.reportsService.patientGrowth(user.clinicId!, from, to);
  }

  @Get("patient-retention")
  patientRetention(
    @CurrentUser() user: RequestUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.reportsService.patientRetention(user.clinicId!, from, to);
  }
}

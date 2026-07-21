import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { NotificationStatus, Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { NotificationsService } from "./notifications.service";

/** Audit/ops visibility only — "was this reminder actually sent" — not a
 * way to trigger sends; those happen from the modules that own the event
 * (appointments, billing, prescriptions). */
@Controller("notifications")
@UseGuards(TenantGuard)
@Roles(Role.CLINIC_OWNER)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("status") status?: NotificationStatus) {
    return this.notificationsService.list(user.clinicId!, { status });
  }
}

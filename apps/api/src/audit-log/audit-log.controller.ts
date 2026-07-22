import { Controller, Get, UseGuards } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { AuditLogService } from "./audit-log.service";

@Controller("audit-log")
@UseGuards(TenantGuard)
@Roles(Role.CLINIC_OWNER)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.auditLogService.list(user.clinicId!);
  }
}

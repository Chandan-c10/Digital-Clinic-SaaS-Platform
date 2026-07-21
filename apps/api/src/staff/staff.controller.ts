import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { StaffService } from "./staff.service";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";
import { SetStaffStatusDto } from "./dto/set-staff-status.dto";

@Controller("staff")
@UseGuards(TenantGuard)
@Roles(Role.CLINIC_OWNER)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.staffService.list(user.clinicId!);
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.staffService.findOne(user.clinicId!, id);
  }

  @Get(":id/activity")
  activity(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.staffService.activity(user.clinicId!, id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateStaffDto) {
    return this.staffService.create(user.clinicId!, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(user.clinicId!, id, dto);
  }

  @Patch(":id/status")
  setStatus(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: SetStaffStatusDto,
  ) {
    return this.staffService.setStatus(user.clinicId!, id, dto.isActive);
  }
}

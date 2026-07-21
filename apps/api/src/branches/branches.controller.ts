import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { BranchesService } from "./branches.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
import { SetBranchStatusDto } from "./dto/set-branch-status.dto";

const STAFF_ROLES = [Role.CLINIC_OWNER, Role.DOCTOR, Role.RECEPTIONIST, Role.NURSE, Role.ACCOUNTANT];

@Controller("branches")
@UseGuards(TenantGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  // Every staff role can read the branch list (needed to pick one when
  // setting availability, booking, or filtering reports) — only
  // CLINIC_OWNER can manage them.
  @Get()
  @Roles(...STAFF_ROLES)
  list(@CurrentUser() user: RequestUser) {
    return this.branchesService.list(user.clinicId!);
  }

  @Get(":id")
  @Roles(...STAFF_ROLES)
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.branchesService.findOne(user.clinicId!, id);
  }

  @Post()
  @Roles(Role.CLINIC_OWNER)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(user.clinicId!, dto);
  }

  @Patch(":id")
  @Roles(Role.CLINIC_OWNER)
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(user.clinicId!, id, dto);
  }

  @Patch(":id/status")
  @Roles(Role.CLINIC_OWNER)
  setStatus(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: SetBranchStatusDto,
  ) {
    return this.branchesService.setStatus(user.clinicId!, id, dto.isActive);
  }
}

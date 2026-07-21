import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { DoctorsService } from "./doctors.service";
import { CreateDoctorDto } from "./dto/create-doctor.dto";
import { UpdateDoctorDto } from "./dto/update-doctor.dto";
import { SetAvailabilityDto } from "./dto/set-availability.dto";

@Controller("doctors")
@UseGuards(TenantGuard)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.doctorsService.list(user.clinicId!);
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.doctorsService.findOne(user.clinicId!, id);
  }

  @Post()
  @Roles(Role.CLINIC_OWNER)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateDoctorDto) {
    return this.doctorsService.create(user.clinicId!, dto);
  }

  @Patch(":id")
  @Roles(Role.CLINIC_OWNER, Role.DOCTOR)
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateDoctorDto) {
    return this.doctorsService.update(user.clinicId!, id, dto);
  }

  @Patch(":id/availability")
  @Roles(Role.CLINIC_OWNER, Role.DOCTOR)
  setAvailability(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.doctorsService.setAvailability(user.clinicId!, id, dto);
  }
}

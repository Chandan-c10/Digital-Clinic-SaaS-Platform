import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { ClinicsService } from "./clinics.service";
import { UpdateClinicProfileDto } from "./dto/update-clinic-profile.dto";
import { UpdateClinicWebsiteDto } from "./dto/update-clinic-website.dto";

@Controller("clinics")
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get("public/:slug")
  @Public()
  getPublicWebsite(@Param("slug") slug: string) {
    return this.clinicsService.getPublishedWebsiteBySlug(slug);
  }

  @Get("me")
  @UseGuards(TenantGuard)
  getOwnClinic(@CurrentUser() user: RequestUser) {
    return this.clinicsService.getOwnClinic(user.clinicId!);
  }

  @Patch("me/profile")
  @UseGuards(TenantGuard)
  @Roles(Role.CLINIC_OWNER)
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateClinicProfileDto) {
    return this.clinicsService.updateProfile(user.clinicId!, dto);
  }

  @Patch("me/website")
  @UseGuards(TenantGuard)
  @Roles(Role.CLINIC_OWNER)
  updateWebsite(@CurrentUser() user: RequestUser, @Body() dto: UpdateClinicWebsiteDto) {
    return this.clinicsService.updateWebsite(user.clinicId!, dto);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@digital-clinic/database";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RequestUser } from "../common/interfaces/request-with-user.interface";
import { InsuranceService } from "./insurance.service";
import { CreateInsuranceProviderDto } from "./dto/create-provider.dto";
import { CreateInsurancePolicyDto } from "./dto/create-policy.dto";
import { FileInsuranceClaimDto } from "./dto/file-claim.dto";
import { RespondInsuranceClaimDto } from "./dto/respond-claim.dto";

const MANAGE_ROLES = [Role.CLINIC_OWNER, Role.RECEPTIONIST, Role.ACCOUNTANT];

@Controller("insurance")
@UseGuards(TenantGuard)
@Roles(...MANAGE_ROLES)
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Get("providers")
  listProviders(@CurrentUser() user: RequestUser) {
    return this.insuranceService.listProviders(user.clinicId!);
  }

  @Post("providers")
  @Roles(Role.CLINIC_OWNER)
  createProvider(@CurrentUser() user: RequestUser, @Body() dto: CreateInsuranceProviderDto) {
    return this.insuranceService.createProvider(user.clinicId!, dto);
  }

  @Get("policies")
  listPolicies(@CurrentUser() user: RequestUser, @Query("patientId") patientId?: string) {
    return this.insuranceService.listPolicies(user.clinicId!, patientId);
  }

  @Post("policies")
  createPolicy(@CurrentUser() user: RequestUser, @Body() dto: CreateInsurancePolicyDto) {
    return this.insuranceService.createPolicy(user.clinicId!, dto);
  }

  @Get("claims")
  listClaims(
    @CurrentUser() user: RequestUser,
    @Query("invoiceId") invoiceId?: string,
    @Query("policyId") policyId?: string,
  ) {
    return this.insuranceService.listClaims(user.clinicId!, { invoiceId, policyId });
  }

  @Get("claims/:id")
  findClaim(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.insuranceService.findClaim(user.clinicId!, id);
  }

  @Post("claims")
  fileClaim(@CurrentUser() user: RequestUser, @Body() dto: FileInsuranceClaimDto) {
    return this.insuranceService.fileClaim(user.clinicId!, user.userId, dto);
  }

  @Patch("claims/:id/respond")
  @Roles(Role.CLINIC_OWNER, Role.ACCOUNTANT)
  respondToClaim(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: RespondInsuranceClaimDto,
  ) {
    return this.insuranceService.respondToClaim(user.clinicId!, id, user.userId, dto);
  }
}

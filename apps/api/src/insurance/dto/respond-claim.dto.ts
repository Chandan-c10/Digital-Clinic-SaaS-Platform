import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";
import { InsuranceClaimStatus } from "@digital-clinic/database";

const RESPONSE_STATUSES = [
  InsuranceClaimStatus.APPROVED,
  InsuranceClaimStatus.PARTIALLY_APPROVED,
  InsuranceClaimStatus.REJECTED,
  InsuranceClaimStatus.PAID,
] as const;

export class RespondInsuranceClaimDto {
  @IsEnum(RESPONSE_STATUSES, {
    message: `status must be one of: ${RESPONSE_STATUSES.join(", ")}`,
  })
  status!: (typeof RESPONSE_STATUSES)[number];

  /** Required for APPROVED/PARTIALLY_APPROVED/PAID — ignored for REJECTED. */
  @IsOptional() @IsNumber() @IsPositive() approvedAmount?: number;

  @IsOptional() @IsString() notes?: string;
}

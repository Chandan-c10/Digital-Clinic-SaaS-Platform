import { IsNumber, IsOptional, IsPositive, IsString } from "class-validator";

export class FileInsuranceClaimDto {
  @IsString() invoiceId!: string;
  @IsString() policyId!: string;

  @IsNumber() @IsPositive() claimedAmount!: number;

  @IsOptional() @IsString() notes?: string;
}

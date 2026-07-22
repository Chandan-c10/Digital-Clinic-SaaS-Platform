import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateInsurancePolicyDto {
  @IsString() patientId!: string;
  @IsString() providerId!: string;
  @IsString() policyNumber!: string;

  @IsOptional() @IsString() memberName?: string;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validTo?: string;
}

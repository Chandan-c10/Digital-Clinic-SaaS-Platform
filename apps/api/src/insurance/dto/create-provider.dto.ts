import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateInsuranceProviderDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
}

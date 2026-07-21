import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateBranchDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() phone?: string;
}

import { IsArray, IsNumber, IsObject, IsOptional, IsString } from "class-validator";

export class UpdateClinicProfileDto {
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsObject() workingHours?: Record<string, string[]>;
  @IsOptional() @IsNumber() consultationFee?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) languagesSpoken?: string[];
  @IsOptional() @IsObject() socialLinks?: Record<string, string>;
}

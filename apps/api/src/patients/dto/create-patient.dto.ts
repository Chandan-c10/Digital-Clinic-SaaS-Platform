import { IsArray, IsDateString, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreatePatientDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) allergies?: string[];
  @IsOptional() @IsString() medicalHistory?: string;
}

import { IsArray, IsEmail, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class CreateDoctorDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  displayName!: string;

  @IsOptional() @IsString() qualification?: string;
  @IsOptional() @IsString() specialization?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  // QA/security audit, TC-FUNC-02: bounded rather than any positive integer.
  @IsOptional() @IsInt() @Min(0) @Max(70) experienceYears?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000) consultationFee?: number;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) languagesSpoken?: string[];
}

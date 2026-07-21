import { IsArray, IsEmail, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

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
  @IsOptional() @IsInt() @Min(0) experienceYears?: number;
  @IsOptional() @IsNumber() consultationFee?: number;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) languagesSpoken?: string[];
}

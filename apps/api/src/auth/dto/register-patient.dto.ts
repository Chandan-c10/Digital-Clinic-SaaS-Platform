import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterPatientDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8, { message: "password must be at least 8 characters" })
  password!: string;
}

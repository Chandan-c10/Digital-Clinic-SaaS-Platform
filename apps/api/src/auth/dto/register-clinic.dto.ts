import { IsEmail, IsString, Matches, MinLength } from "class-validator";

export class RegisterClinicDto {
  @IsString()
  @MinLength(2)
  clinicName!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,63}$/, {
    message: "slug must be 3-63 lowercase letters, numbers, or hyphens",
  })
  slug!: string;

  @IsString()
  @MinLength(2)
  ownerName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: "password must be at least 8 characters" })
  password!: string;
}

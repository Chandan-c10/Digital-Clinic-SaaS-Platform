import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { STAFF_MANAGEABLE_ROLES, StaffRole } from "../staff-roles";

export class CreateStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(STAFF_MANAGEABLE_ROLES, {
    message: `role must be one of: ${STAFF_MANAGEABLE_ROLES.join(", ")}`,
  })
  role!: StaffRole;
}

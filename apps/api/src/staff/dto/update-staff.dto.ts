import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateStaffDto } from "./create-staff.dto";

export class UpdateStaffDto extends PartialType(
  OmitType(CreateStaffDto, ["email", "password"] as const),
) {}

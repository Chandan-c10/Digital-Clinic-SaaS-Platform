import { IsBoolean } from "class-validator";

export class SetStaffStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

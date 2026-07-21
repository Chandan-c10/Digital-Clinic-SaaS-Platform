import { IsBoolean } from "class-validator";

export class SetBranchStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

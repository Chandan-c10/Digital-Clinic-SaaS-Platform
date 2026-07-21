import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateInventoryItemDto } from "./create-item.dto";

export class UpdateInventoryItemDto extends PartialType(CreateInventoryItemDto) {
  @IsOptional() @IsBoolean() isActive?: boolean;
}

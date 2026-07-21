import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateInventoryItemDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional() @IsString() sku?: string;

  @IsString()
  unit!: string;

  @IsOptional() @IsString() category?: string;

  @IsOptional() @IsInt() @Min(0) reorderLevel?: number;
}

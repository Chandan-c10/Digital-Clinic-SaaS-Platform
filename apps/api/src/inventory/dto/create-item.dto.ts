import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class CreateInventoryItemDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional() @IsString() sku?: string;

  @IsString()
  unit!: string;

  @IsOptional() @IsString() category?: string;

  // QA/security audit, TC-FUNC-02: bounded rather than any positive integer.
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) reorderLevel?: number;
}

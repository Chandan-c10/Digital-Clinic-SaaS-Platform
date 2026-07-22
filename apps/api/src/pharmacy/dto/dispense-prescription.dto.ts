import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

class DispenseLineDto {
  @IsString() inventoryItemId!: string;
  // QA/security audit, TC-FUNC-02: bounded rather than any positive integer.
  @IsInt() @Min(1) @Max(1_000_000) quantity!: number;
}

export class DispensePrescriptionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DispenseLineDto)
  items!: DispenseLineDto[];

  @IsOptional() @IsString() branchId?: string;
}

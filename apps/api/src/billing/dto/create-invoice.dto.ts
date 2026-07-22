import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

// QA/security audit, TC-FUNC-02: every money/quantity field bounded, not
// just checked for a sane lower end.
const MAX_LINE_ITEM_QUANTITY = 100_000;
const MAX_MONEY_AMOUNT = 10_000_000;

class LineItemDto {
  @IsString() description!: string;
  @IsInt() @Min(1) @Max(MAX_LINE_ITEM_QUANTITY) quantity!: number;
  @IsNumber() @Min(0) @Max(MAX_MONEY_AMOUNT) unitPrice!: number;
}

export class CreateInvoiceDto {
  @IsString()
  patientId!: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems!: LineItemDto[];

  @IsOptional() @IsNumber() @Min(0) @Max(MAX_MONEY_AMOUNT) discountAmount?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(MAX_MONEY_AMOUNT) taxAmount?: number;
  @IsOptional() @IsString() notes?: string;
}

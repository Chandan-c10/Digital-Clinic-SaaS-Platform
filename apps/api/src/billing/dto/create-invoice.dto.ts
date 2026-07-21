import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

class LineItemDto {
  @IsString() description!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsNumber() @Min(0) unitPrice!: number;
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

  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @IsOptional() @IsNumber() @Min(0) taxAmount?: number;
  @IsOptional() @IsString() notes?: string;
}

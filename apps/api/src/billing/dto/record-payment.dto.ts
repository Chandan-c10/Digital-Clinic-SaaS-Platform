import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";
import { PaymentMethod } from "@digital-clinic/database";

export class RecordPaymentDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  reference?: string;
}

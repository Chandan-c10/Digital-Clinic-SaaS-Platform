import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

class MedicineDto {
  @IsString() name!: string;
  @IsString() dosage!: string;
  @IsString() frequency!: string;
  @IsInt() @Min(1) durationDays!: number;
  @IsOptional() @IsString() instructions?: string;
}

export class CreatePrescriptionDto {
  @IsString()
  patientId!: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MedicineDto)
  medicines!: MedicineDto[];

  @IsOptional() @IsString() notes?: string;
}

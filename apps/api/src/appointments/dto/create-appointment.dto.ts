import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { AppointmentType } from "@digital-clinic/database";

export class CreateAppointmentDto {
  @IsString()
  patientId!: string;

  @IsString()
  doctorId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional() @IsInt() @Min(5) durationMinutes?: number;

  @IsOptional() @IsEnum(AppointmentType) type?: AppointmentType;

  @IsOptional() @IsString() reasonForVisit?: string;
}

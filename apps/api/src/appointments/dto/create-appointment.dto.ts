import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { AppointmentType } from "@digital-clinic/database";

export class CreateAppointmentDto {
  @IsString()
  patientId!: string;

  @IsString()
  doctorId!: string;

  @IsDateString()
  scheduledAt!: string;

  // QA/security audit, TC-FUNC-02: bounded to a workday-ish upper limit.
  @IsOptional() @IsInt() @Min(5) @Max(480) durationMinutes?: number;

  @IsOptional() @IsEnum(AppointmentType) type?: AppointmentType;

  @IsOptional() @IsString() reasonForVisit?: string;
}

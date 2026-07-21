import { IsDateString, IsOptional, IsString } from "class-validator";

export class PortalBookAppointmentDto {
  @IsString()
  clinicId!: string;

  @IsString()
  doctorId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  reasonForVisit?: string;
}

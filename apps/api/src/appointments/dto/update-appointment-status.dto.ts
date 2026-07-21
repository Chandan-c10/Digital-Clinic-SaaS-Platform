import { IsEnum } from "class-validator";
import { AppointmentStatus } from "@digital-clinic/database";

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  status!: AppointmentStatus;
}

import { IsDateString } from "class-validator";

export class RescheduleAppointmentDto {
  @IsDateString()
  scheduledAt!: string;
}

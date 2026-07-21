import { IsDateString, IsString } from "class-validator";

export class PortalAvailableSlotsQueryDto {
  @IsString()
  clinicId!: string;

  @IsString()
  doctorId!: string;

  @IsDateString()
  date!: string;
}

import { IsDateString, IsString } from "class-validator";

export class AvailableSlotsQueryDto {
  @IsString()
  doctorId!: string;

  /** Calendar date, e.g. "2026-07-22" — slots are computed for this single day. */
  @IsDateString()
  date!: string;
}

import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsString, Max, Min, ValidateNested } from "class-validator";

export class AvailabilitySlotDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsInt() @Min(5) slotDurationMinutes!: number;
}

export class SetAvailabilityDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots!: AvailabilitySlotDto[];
}

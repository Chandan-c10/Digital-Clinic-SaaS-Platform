import { IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { InventoryTransactionType } from "@digital-clinic/database";

export class CreateInventoryTransactionDto {
  @IsEnum(InventoryTransactionType)
  type!: InventoryTransactionType;

  /**
   * Magnitude for RECEIVED/DISPENSED/EXPIRED/DAMAGED — always positive, the
   * service applies the correct sign for the type. For ADJUSTED, the sign
   * you send *is* the correction (positive to add, negative to subtract).
   */
  @IsInt()
  quantity!: number;

  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() reason?: string;
}

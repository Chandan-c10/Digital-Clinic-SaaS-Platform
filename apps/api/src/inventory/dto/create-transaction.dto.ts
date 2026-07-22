import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { InventoryTransactionType } from "@digital-clinic/database";

export class CreateInventoryTransactionDto {
  @IsEnum(InventoryTransactionType)
  type!: InventoryTransactionType;

  /**
   * Magnitude for RECEIVED/DISPENSED/EXPIRED/DAMAGED — always positive, the
   * service applies the correct sign for the type. For ADJUSTED, the sign
   * you send *is* the correction (positive to add, negative to subtract) —
   * hence a symmetric bound (QA/security audit, TC-FUNC-02) rather than
   * @Min(1), which would wrongly reject a legitimate negative ADJUSTED.
   */
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  quantity!: number;

  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() reason?: string;
}

import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { PharmacyController } from "./pharmacy.controller";
import { PharmacyService } from "./pharmacy.service";

@Module({
  imports: [InventoryModule],
  controllers: [PharmacyController],
  providers: [PharmacyService],
})
export class PharmacyModule {}

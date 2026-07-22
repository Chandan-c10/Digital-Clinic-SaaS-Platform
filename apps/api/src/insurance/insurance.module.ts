import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { InsuranceController } from "./insurance.controller";
import { InsuranceService } from "./insurance.service";

@Module({
  imports: [BillingModule],
  controllers: [InsuranceController],
  providers: [InsuranceService],
})
export class InsuranceModule {}

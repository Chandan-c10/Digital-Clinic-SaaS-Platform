import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PatientPortalController } from "./patient-portal.controller";
import { PatientPortalService } from "./patient-portal.service";

@Module({
  imports: [NotificationsModule],
  controllers: [PatientPortalController],
  providers: [PatientPortalService],
})
export class PatientPortalModule {}

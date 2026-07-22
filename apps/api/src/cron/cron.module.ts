import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { CronController } from "./cron.controller";
import { CronService } from "./cron.service";
import { CronSecretGuard } from "./cron-secret.guard";

@Module({
  imports: [NotificationsModule],
  controllers: [CronController],
  providers: [CronService, CronSecretGuard],
})
export class CronModule {}

import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { EmailProvider } from "./providers/email.provider";
import { SmsProvider } from "./providers/sms.provider";
import { WhatsAppProvider } from "./providers/whatsapp.provider";

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailProvider, SmsProvider, WhatsAppProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}

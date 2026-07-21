import { Injectable } from "@nestjs/common";
import { NotificationDispatchResult, NotificationProvider } from "./notification-provider.interface";

/**
 * No WhatsApp Business API account is wired up — that needs Meta
 * verification and API credentials this project doesn't have. Always
 * records an honest failure rather than faking a send; swap this out once a
 * real account exists (see README § Roadmap).
 */
@Injectable()
export class WhatsAppProvider implements NotificationProvider {
  async send(): Promise<NotificationDispatchResult> {
    return {
      status: "FAILED",
      error: "No WhatsApp Business API account configured — wire it up in WhatsAppProvider",
    };
  }
}

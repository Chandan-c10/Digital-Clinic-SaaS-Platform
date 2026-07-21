import { Injectable } from "@nestjs/common";
import { NotificationDispatchResult, NotificationProvider } from "./notification-provider.interface";

/**
 * No SMS gateway is wired up — that needs a real account (e.g. Twilio,
 * MSG91) and API keys this project doesn't have. Always records an honest
 * failure rather than faking a send; swap this out once real credentials
 * exist (see README § Roadmap).
 */
@Injectable()
export class SmsProvider implements NotificationProvider {
  async send(): Promise<NotificationDispatchResult> {
    return {
      status: "FAILED",
      error: "No SMS provider configured — wire up a gateway (e.g. Twilio, MSG91) in SmsProvider",
    };
  }
}

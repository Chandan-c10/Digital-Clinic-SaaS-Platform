import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { Transporter } from "nodemailer";
import { NotificationDispatchResult, NotificationProvider } from "./notification-provider.interface";

/**
 * Real SMTP sender via nodemailer — no vendor SDK/account needed, just the
 * SMTP_* env vars already in .env.example. If they're unset (the common case
 * in dev), sends fail honestly with a clear reason rather than pretending to
 * succeed; the calling code (NotificationsService) records that as-is.
 */
@Injectable()
export class EmailProvider implements NotificationProvider {
  private transporter: Transporter | null = null;
  private triedToConnect = false;

  constructor(private readonly config: ConfigService) {}

  private getTransporter(): Transporter | null {
    if (this.triedToConnect) return this.transporter;
    this.triedToConnect = true;

    const host = this.config.get<string>("SMTP_HOST");
    const port = this.config.get<string>("SMTP_PORT");
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASS");
    if (!host || !port || !user || !pass) return null;

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });
    return this.transporter;
  }

  async send(recipient: string, subject: string | undefined, body: string): Promise<NotificationDispatchResult> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return { status: "FAILED", error: "SMTP is not configured (set SMTP_HOST/PORT/USER/PASS in .env)" };
    }

    try {
      await transporter.sendMail({
        from: this.config.get<string>("SMTP_USER"),
        to: recipient,
        subject: subject ?? "Notification from your clinic",
        text: body,
      });
      return { status: "SENT" };
    } catch (error) {
      return { status: "FAILED", error: error instanceof Error ? error.message : "Unknown SMTP error" };
    }
  }
}

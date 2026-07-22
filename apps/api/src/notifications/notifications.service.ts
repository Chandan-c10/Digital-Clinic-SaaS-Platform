import { Injectable, Logger } from "@nestjs/common";
import { NotificationChannel, NotificationStatus, NotificationType } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { EmailProvider } from "./providers/email.provider";
import { SmsProvider } from "./providers/sms.provider";
import { WhatsAppProvider } from "./providers/whatsapp.provider";
import { NotificationProvider } from "./providers/notification-provider.interface";

interface SendParams {
  clinicId: string;
  channel: NotificationChannel;
  type: NotificationType;
  recipient: string | null | undefined;
  subject?: string;
  body: string;
  appointmentId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProvider: EmailProvider,
    private readonly smsProvider: SmsProvider,
    private readonly whatsAppProvider: WhatsAppProvider,
  ) {}

  list(clinicId: string, filters: { status?: NotificationStatus } = {}) {
    return this.prisma.notification.findMany({
      where: { clinicId, ...filters },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  /**
   * Records the attempt and dispatches it. Deliberately never throws or
   * rejects, under any failure mode (provider error, DB write failure) — a
   * notification failure must never break the operation that triggered it
   * (booking an appointment, creating an invoice), and every call site here
   * fires this with `void` rather than awaiting it. Failures are logged and,
   * where possible, recorded on the Notification row instead of surfacing as
   * an API error or an unhandled rejection.
   */
  async send(params: SendParams): Promise<void> {
    if (!params.recipient) {
      this.logger.debug(`Skipping ${params.type} notification — no recipient on file`);
      return;
    }

    try {
      const notification = await this.prisma.notification.create({
        data: {
          clinicId: params.clinicId,
          channel: params.channel,
          type: params.type,
          recipient: params.recipient,
          subject: params.subject,
          body: params.body,
          appointmentId: params.appointmentId,
        },
      });

      const result = await this.providerFor(params.channel).send(
        params.recipient,
        params.subject,
        params.body,
      );

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: result.status,
          error: result.error,
          sentAt: result.status === "SENT" ? new Date() : null,
        },
      });

      if (result.status === "FAILED") {
        this.logger.warn(`Notification ${notification.id} (${params.type}) failed: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(
        `Notification dispatch for ${params.type} raised unexpectedly: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Dedup check for the reminder cron (apps/api/src/cron/) — avoids sending
   * a second reminder if the job runs more than once for the same day. */
  async reminderAlreadySent(appointmentId: string): Promise<boolean> {
    const existing = await this.prisma.notification.findFirst({
      where: { appointmentId, type: NotificationType.APPOINTMENT_REMINDER },
      select: { id: true },
    });
    return existing !== null;
  }

  private providerFor(channel: NotificationChannel): NotificationProvider {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return this.emailProvider;
      case NotificationChannel.SMS:
        return this.smsProvider;
      case NotificationChannel.WHATSAPP:
        return this.whatsAppProvider;
    }
  }
}

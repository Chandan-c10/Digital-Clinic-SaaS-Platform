import { Injectable, Logger } from "@nestjs/common";
import { AppointmentStatus, NotificationChannel, NotificationType } from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Finds every CONFIRMED appointment scheduled for tomorrow (calendar day,
   * server time) across every clinic and emails a reminder — this runs
   * across all tenants at once, unlike every other service in this
   * codebase, because it's a system job, not a request on behalf of one
   * clinic's user. There's no TenantGuard here; CronSecretGuard (a shared
   * secret header) is the entire auth boundary for this route.
   */
  async sendAppointmentReminders(): Promise<{ sent: number; skipped: number }> {
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.CONFIRMED,
        scheduledAt: { gte: tomorrowStart, lt: tomorrowEnd },
      },
      include: { patient: true, doctor: true },
    });

    let sent = 0;
    let skipped = 0;
    for (const appointment of appointments) {
      // Dedup so a cron that fires more than once in a day (retry, manual
      // trigger) doesn't double-send — see NotificationsService.reminderAlreadySent.
      if (await this.notifications.reminderAlreadySent(appointment.id)) {
        skipped++;
        continue;
      }

      await this.notifications.send({
        clinicId: appointment.clinicId,
        channel: NotificationChannel.EMAIL,
        type: NotificationType.APPOINTMENT_REMINDER,
        recipient: appointment.patient.email,
        subject: "Appointment reminder",
        body: `Reminder: you have an appointment with ${appointment.doctor.displayName} tomorrow at ${appointment.scheduledAt.toLocaleString()}.`,
        appointmentId: appointment.id,
      });
      sent++;
    }

    this.logger.log(`Appointment reminders: ${sent} sent, ${skipped} already sent`);
    return { sent, skipped };
  }
}

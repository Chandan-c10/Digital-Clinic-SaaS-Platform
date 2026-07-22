import { CronService } from "./cron.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

function makePrismaMock() {
  return {
    appointment: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
}

function makeNotificationsMock() {
  return {
    send: jest.fn().mockResolvedValue(undefined),
    reminderAlreadySent: jest.fn().mockResolvedValue(false),
  } as unknown as NotificationsService;
}

describe("CronService.sendAppointmentReminders", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let notifications: ReturnType<typeof makeNotificationsMock>;
  let service: CronService;

  beforeEach(() => {
    prisma = makePrismaMock();
    notifications = makeNotificationsMock();
    service = new CronService(prisma, notifications);
  });

  it("queries CONFIRMED appointments in a one-calendar-day window starting tomorrow", async () => {
    await service.sendAppointmentReminders();

    const call = (prisma.appointment.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.status).toBe("CONFIRMED");
    const { gte, lt } = call.where.scheduledAt;
    expect(lt.getTime() - gte.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(gte.getHours()).toBe(0);
    // gte should be "tomorrow" relative to now, not today.
    expect(gte.getTime()).toBeGreaterThan(Date.now());
  });

  it("sends a reminder and stamps appointmentId for each appointment without one yet", async () => {
    (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
      {
        id: "appt-1",
        clinicId: "clinic-1",
        scheduledAt: new Date("2026-08-01T09:00:00.000Z"),
        patient: { email: "patient@example.com" },
        doctor: { displayName: "Dr. Rao" },
      },
    ]);

    const result = await service.sendAppointmentReminders();

    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: "clinic-1",
        type: "APPOINTMENT_REMINDER",
        recipient: "patient@example.com",
        appointmentId: "appt-1",
      }),
    );
    expect(result).toEqual({ sent: 1, skipped: 0 });
  });

  it("skips an appointment that already has a reminder, without calling send()", async () => {
    (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
      {
        id: "appt-1",
        clinicId: "clinic-1",
        scheduledAt: new Date("2026-08-01T09:00:00.000Z"),
        patient: { email: "patient@example.com" },
        doctor: { displayName: "Dr. Rao" },
      },
    ]);
    (notifications.reminderAlreadySent as jest.Mock).mockResolvedValue(true);

    const result = await service.sendAppointmentReminders();

    expect(notifications.send).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, skipped: 1 });
  });

  it("runs across every clinic — no clinicId filter on the query (this is a system job, not tenant-scoped)", async () => {
    await service.sendAppointmentReminders();
    const call = (prisma.appointment.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where).not.toHaveProperty("clinicId");
  });
});

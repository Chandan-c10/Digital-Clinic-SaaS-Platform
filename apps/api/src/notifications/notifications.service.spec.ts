import { NotificationChannel, NotificationType } from "@digital-clinic/database";
import { NotificationsService } from "./notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailProvider } from "./providers/email.provider";
import { SmsProvider } from "./providers/sms.provider";
import { WhatsAppProvider } from "./providers/whatsapp.provider";

function makePrismaMock() {
  return {
    notification: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
}

describe("NotificationsService", () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let emailProvider: { send: jest.Mock };
  let smsProvider: { send: jest.Mock };
  let whatsAppProvider: { send: jest.Mock };
  let service: NotificationsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    emailProvider = { send: jest.fn() };
    smsProvider = { send: jest.fn() };
    whatsAppProvider = { send: jest.fn() };
    service = new NotificationsService(
      prisma,
      emailProvider as unknown as EmailProvider,
      smsProvider as unknown as SmsProvider,
      whatsAppProvider as unknown as WhatsAppProvider,
    );
  });

  it("scopes list() to the caller's clinic", async () => {
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
    await service.list("clinic-1");
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clinicId: "clinic-1" }) }),
    );
  });

  it("skips sending (and doesn't record an attempt) when there's no recipient on file", async () => {
    await service.send({
      clinicId: "clinic-1",
      channel: NotificationChannel.EMAIL,
      type: NotificationType.APPOINTMENT_CONFIRMATION,
      recipient: null,
      body: "hi",
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it("routes EMAIL to the email provider and records a successful send", async () => {
    (prisma.notification.create as jest.Mock).mockResolvedValue({ id: "n1" });
    emailProvider.send.mockResolvedValue({ status: "SENT" });

    await service.send({
      clinicId: "clinic-1",
      channel: NotificationChannel.EMAIL,
      type: NotificationType.APPOINTMENT_CONFIRMATION,
      recipient: "patient@example.com",
      subject: "Confirmed",
      body: "Your appointment is confirmed",
    });

    expect(emailProvider.send).toHaveBeenCalledWith(
      "patient@example.com",
      "Confirmed",
      "Your appointment is confirmed",
    );
    expect(smsProvider.send).not.toHaveBeenCalled();
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "n1" },
        data: expect.objectContaining({ status: "SENT" }),
      }),
    );
  });

  it("records an honest failure for SMS (no provider configured) without throwing", async () => {
    (prisma.notification.create as jest.Mock).mockResolvedValue({ id: "n2" });
    smsProvider.send.mockResolvedValue({ status: "FAILED", error: "No SMS provider configured" });

    await expect(
      service.send({
        clinicId: "clinic-1",
        channel: NotificationChannel.SMS,
        type: NotificationType.APPOINTMENT_REMINDER,
        recipient: "+919999999999",
        body: "Reminder",
      }),
    ).resolves.toBeUndefined();

    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", error: "No SMS provider configured" }),
      }),
    );
  });
});
